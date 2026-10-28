// True two-session regression against a disposable PostgreSQL service.
// Only the source migrations define admission and creator-marker behavior.
// Deliberately no credentials, Supabase project access or external dependencies.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';

const digestA = 'a'.repeat(64);
const digestB = 'b'.repeat(64);
const psqlArgs = ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'];

function sql(query) {
  const result = spawnSync('psql', [...psqlArgs, '-c', query], {
    encoding: 'utf8', timeout: 12000,
  });
  if (result.error || result.status !== 0) {
    throw new Error('psql failed: ' + String(result.error || result.stderr));
  }
  return result.stdout.trim();
}

class Connection {
  constructor(name) {
    this.name = name;
    this.lines = [];
    this.stderr = '';
    this.child = spawn('psql', psqlArgs, {
      env: { ...process.env, PGAPPNAME: name },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', chunk => { this.stderr += chunk; });
    const reader = createInterface({ input: this.child.stdout });
    reader.on('line', line => { this.lines.push(line.trim()); });
  }

  send(query) {
    assert.equal(this.child.exitCode, null, this.name + ' exited: ' + this.stderr);
    this.child.stdin.write(query + '\n');
  }

  async see(expected, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.lines.includes(expected)) return;
      if (this.child.exitCode !== null) {
        throw new Error(this.name + ' exited before ' + expected + ': ' + this.stderr);
      }
      await delay(35);
    }
    throw new Error(this.name + ' did not produce ' + expected +
      '; stdout=' + JSON.stringify(this.lines) + '; stderr=' + this.stderr);
  }

  async close() {
    if (this.child.exitCode === null) this.child.stdin.end();
    const deadline = Date.now() + 2500;
    while (this.child.exitCode === null && Date.now() < deadline) await delay(30);
    if (this.child.exitCode === null) this.child.kill('SIGKILL');
    assert.equal(this.child.exitCode, 0, this.name + ' failed: ' + this.stderr);
  }

  abort() {
    if (this.child.exitCode === null) this.child.kill('SIGKILL');
  }
}

async function verifyBlocked(applicationName) {
  const deadline = Date.now() + 6500;
  while (Date.now() < deadline) {
    const observed = Number(sql(
      "select count(*) from pg_stat_activity where application_name='" +
      applicationName + "' and wait_event_type='Lock'"
    ));
    if (observed > 0) return;
    await delay(75);
  }
  throw new Error('No PostgreSQL lock wait observed for ' + applicationName +
    '; not a valid concurrent-session test');
}

async function markerCommitsFirst() {
  const marker = new Connection('creator_race_marker_a');
  const admit = new Connection('creator_race_admit_b');
  try {
    marker.send("begin; update public.custom_nine_attempt_states " +
      "set creator_seen=true where challenge_id='race-marker-first' " +
      "and browser_key_digest='" + digestA + "';" +
      "select 'MARKER_LOCKED';");
    await marker.see('MARKER_LOCKED');

    admit.send("begin; select public.race_try_admit('race-marker-first','" +
      digestA + "'); select 'ADMISSION_RETURNED';");
    await verifyBlocked('creator_race_admit_b');

    marker.send("commit; select 'MARKER_COMMITTED';");
    await marker.see('MARKER_COMMITTED');
    await admit.see('rejected');
    await admit.see('ADMISSION_RETURNED');
    admit.send("commit; select 'ADMISSION_COMMITTED';");
    await admit.see('ADMISSION_COMMITTED');

    assert.equal(sql("select case when " +
      "(select creator_seen from public.custom_nine_attempt_states " +
      "where challenge_id='race-marker-first') " +
      "and not exists (select 1 from public.custom_nine_completed_results " +
      "where challenge_id='race-marker-first') " +
      "then 'ok' else 'bad' end"), 'ok');
    await marker.close();
    await admit.close();
    console.log('PASS: marker held row lock; admission waited then rejected');
  } catch (error) {
    marker.abort();
    admit.abort();
    throw error;
  }
}

async function admissionCommitsFirst() {
  const admit = new Connection('creator_race_admit_a');
  const marker = new Connection('creator_race_marker_b');
  try {
    admit.send("begin; select public.race_try_admit('race-admission-first','" +
      digestB + "'); select 'ADMISSION_HELD';");
    await admit.see('admitted');
    await admit.see('ADMISSION_HELD');

    marker.send("begin; update public.custom_nine_attempt_states " +
      "set creator_seen=true where challenge_id='race-admission-first' " +
      "and browser_key_digest='" + digestB + "';" +
      "select 'MARKER_APPLIED';");
    await verifyBlocked('creator_race_marker_b');

    admit.send("commit; select 'ADMISSION_COMMITTED';");
    await admit.see('ADMISSION_COMMITTED');
    await marker.see('MARKER_APPLIED');
    marker.send("commit; select 'MARKER_COMMITTED';");
    await marker.see('MARKER_COMMITTED');

    assert.equal(sql("select case when " +
      "(select creator_seen from public.custom_nine_attempt_states " +
      "where challenge_id='race-admission-first') " +
      "and (select count(*) from public.custom_nine_completed_results " +
      "where challenge_id='race-admission-first' and summary->>'points'='4')=1 " +
      "and (select count(*) from public.custom_nine_at_bat_results " +
      "where challenge_id='race-admission-first' and awarded_points=4)=1 " +
      "then 'ok' else 'bad' end"), 'ok');
    assert.equal(sql("select public.race_try_admit('race-admission-first','" +
      digestB + "')"), 'rejected');
    await admit.close();
    await marker.close();
    console.log('PASS: admission held row lock; marker waited, then excluded retries');
  } catch (error) {
    admit.abort();
    marker.abort();
    throw error;
  }
}

assert.ok(process.env.PGHOST && process.env.PGUSER,
  'Provide an explicit disposable PostgreSQL test connection');
await markerCommitsFirst();
await admissionCommitsFirst();
console.log('PASS: real concurrent PostgreSQL sessions, both lock orders');
