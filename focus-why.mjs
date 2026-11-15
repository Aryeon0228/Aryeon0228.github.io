import {SUBJECTS,isSharp,sharpZone,formatLength,formatFocusRange} from './focus-optics.mjs';

export function explain(s,N){
 const sharp=SUBJECTS.filter(subject=>isSharp(subject.distance,s,N));
 const zone=sharpZone(s,N);
 const sentence=sharp.length===3?'세 물체가 모두 선명하게 보입니다. ':sharp.length?`${sharp.map(subject=>subject.name).join(', ')}이 선명하고, 나머지는 흐리게 보입니다. `:'지금 초점을 맞춘 거리에는 물체가 없어 세 물체가 모두 흐립니다. ';
 return [
  {text:sentence},
  {text:'선명하게 보이는 거리는 '},
  {text:formatFocusRange(zone),strong:true},
  {text:Number.isFinite(zone.depth)?`입니다. 이 범위의 깊이는 ${formatLength(zone.depth)}입니다.`:'입니다.'},
  ...(N>2&&sharp.length<3&&s<3?[{text:' 조리개를 조이면 선명한 범위가 넓어지지만, 가까이 찍을 때는 여전히 좁습니다.'}]:[])
 ];
}
