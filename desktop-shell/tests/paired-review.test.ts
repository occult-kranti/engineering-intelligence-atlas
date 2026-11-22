import { describe, it, expect } from 'vitest';
import { parseReviewReply, assertPairedAttempt } from '../src/main/pairedReview';
import type { OfficeJob, OfficeSnapshot } from '../src/shared/office';

describe('managed pair boundary', () => {
  const reply = { verdict: 'accepted', summary: 'Compared the deliverable to its supplied acceptance checks.', evidenceRefs: ['job-primary'] };
  it('parses only bounded review data and rejects embedded command authority', () => {
    expect(parseReviewReply(JSON.stringify(reply))).toEqual(reply);
    for (const invalid of [ 'Accepted!', '```json\n{}\n```', JSON.stringify({...reply, command:{action:'grant_authority'}}),
      JSON.stringify({...reply,verdict:'done'}),JSON.stringify({...reply,verdict:['accepted']}),JSON.stringify({...reply,summary:' '}),JSON.stringify({...reply,evidenceRefs:[1]}),
      JSON.stringify({...reply,evidenceRefs:Array(21).fill('evidence')}),JSON.stringify({...reply,evidenceRefs:['é'.repeat(151)]}),
      JSON.stringify({...reply,summary:'é'.repeat(1001)}), 'x'.repeat(16001), 'null', '[]' ]) expect(()=>parseReviewReply(invalid)).toThrow();
  });
  it('requires schema2 and a distinct pair before provider dispatch', () => {
    const job = {id:'p',employeeId:'producer',allowedTools:[],dependencies:[],pair:{stepId:'s',phase:'primary',peerEmployeeId:'reviewer',primaryJobId:'p',reviewJobId:'r'}} as unknown as OfficeJob;
    expect(()=>assertPairedAttempt(job,{schemaVersion:2} as OfficeSnapshot)).not.toThrow();
    expect(()=>assertPairedAttempt(job,{schemaVersion:1} as OfficeSnapshot)).toThrow(/PAIR_REQUIRED/);
    expect(()=>assertPairedAttempt({...job,pair:null},{schemaVersion:2} as OfficeSnapshot)).toThrow(/PAIR_REQUIRED/);
    expect(()=>assertPairedAttempt({...job,pair:{...job.pair!,peerEmployeeId:'producer'}},{schemaVersion:2} as OfficeSnapshot)).toThrow(/PAIR_REQUIRED/);
    const review = {...job,id:'r',employeeId:'reviewer',dependencies:['p'],pair:{...job.pair!,phase:'review' as const,peerEmployeeId:'producer'}};
    expect(()=>assertPairedAttempt(review,{schemaVersion:2} as OfficeSnapshot)).not.toThrow();
    expect(()=>assertPairedAttempt({...review,allowedTools:['github.publish_changes']},{schemaVersion:2} as OfficeSnapshot)).toThrow(/no write tools/);
    expect(()=>assertPairedAttempt({...review,dependencies:[]},{schemaVersion:2} as OfficeSnapshot)).toThrow(/depend/);
  });
});
