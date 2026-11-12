// Verify reviewed supplements before adding any rows to canonical appearance facts.
export function validateVerifiedAppearanceRows({
  sourceAppearanceRows, verifiedAppearanceRows, knownTeamSeasons,
  canonicalByLahmanId, batting, pitching,
}) {
  const issues = [];
  const acceptedRows = [];
  const clean = value => String(value ?? '').trim();
  const yearFromSource = value => {
    const n = Number.parseInt(clean(value), 10);
    return Number.isFinite(n) ? n : 0;
  };
  const originalSeasons = new Set(sourceAppearanceRows.map(row =>
    `${clean(row.playerID)}|${yearFromSource(row.yearID)}`));
  const documentedSeasons = new Set([...batting.facts, ...pitching.facts].map(row =>
    `${row.lahmanPlayerId}|${row.season}`));
  const seen = new Set();
  for (const row of verifiedAppearanceRows) {
    const rowIssues = [];
    const player = clean(row.playerID);
    // Exact numeric source values are required; prefix parsing is prohibited.
    const sourceYear = clean(row.yearID);
    const year = /^\d{4}$/.test(sourceYear) ? Number(sourceYear) : NaN;
    const key = `${player}|${year}`;
    if (seen.has(key)) rowIssues.push(`Duplicate verified appearance season: ${key}`);
    seen.add(key);
    if (!canonicalByLahmanId.has(player)) rowIssues.push(`Unknown verified appearance identity: ${key}`);
    if (!Number.isInteger(year) || year < 1871 || year > 2100) {
      rowIssues.push(`Invalid verified appearance year: ${key}`);
    }
    const teamId = clean(row.teamID);
    if (!teamId) rowIssues.push(`Missing verified appearance team: ${key}`);
    else if (!knownTeamSeasons.has(`${year}|${teamId}`)) {
      rowIssues.push(`Unknown verified appearance team-season: ${key}:${teamId}`);
    }
    const sourceGames = clean(row.G_all);
    const games = /^(?:0|[1-9]\d*)$/.test(sourceGames) ? Number(sourceGames) : NaN;
    if (!Number.isSafeInteger(games) || games < 1) {
      rowIssues.push(`Invalid verified appearance games: ${key}`);
    }
    if (!/^https:\/\/www\.mlb\.com\/player\/[a-z0-9-]+$/i.test(clean(row.sourceURL))) {
      rowIssues.push(`Invalid verified appearance MLB provenance URL: ${key}`);
    }
    if (originalSeasons.has(key)) rowIssues.push(`Verified appearance overlaps Lahman: ${key}`);
    if (!documentedSeasons.has(key)) rowIssues.push(`Verified appearance has no batting/pitching season: ${key}`);
    for (const field of Object.keys(row)) {
      if (field.startsWith('G_') && field !== 'G_all' && clean(row[field])) {
        rowIssues.push(`Unverified positional appearance count: ${key}:${field}`);
      }
    }
    // Invalid evidence never reaches generated artifacts, even without --strict.
    if (rowIssues.length === 0) acceptedRows.push(row);
    issues.push(...rowIssues);
  }
  return { issues, acceptedRows };
}
