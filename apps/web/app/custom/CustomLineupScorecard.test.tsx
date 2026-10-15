import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CustomLineupScorecard } from './CustomLineupScorecard';

function pitches(n:number){
  return Array.from({length:n},(_,i)=>({pitchNumber:i+1,initials:'P'+(i+1)}));
}
function facts(n:number){
  return Array.from({length:n},(_,i)=>({
    pitchNumber:i+1,initials:'P'+(i+1),outcome:'HR' as const,
    hintsRevealed:0 as const,wrongGuesses:0,resolution:'correct' as const,
  }));
}
const render=(n:number,completed:number,current:number|null)=>
  renderToStaticMarkup(<CustomLineupScorecard atBats={pitches(n)}
    completedAtBats={facts(completed)} currentPitch={current} />);

describe('Custom v2 responsive scorecard 1–10 presentations',()=>{
  it.each([1,5,9,10])('renders N=%i exact numbered rows without future answers',n=>{
    const html=render(n,0,1);
    expect(html.match(/class="custom-lineup-score-row/g)?.length).toBe(n);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('At bat');
    expect(html).not.toContain('PRIVATE_ANSWER');
    expect(html).toContain('/ '+4*n+' pts');
  });
  it.each([1,5,9,10])('shows N=%i completed earned points using engine rules',n=>{
    const html=render(n,n,null);
    expect(html).toContain('<strong>'+4*n+'</strong>');
    expect(html).not.toContain('aria-current="step"');
    expect(html).toContain('HR');
    expect(html).not.toContain('At bat</span>');
  });
  it('identifies current fifth batter and only past four point contributions',()=>{
    const html=render(10,4,5);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('<strong>16</strong>');
    expect(html).toContain('P5');
    expect(html).toContain('P10');
  });
});
