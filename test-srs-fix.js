// Test the fixed Spaced Repetition Algorithm
const { SpacedRepetitionAlgorithm, ReviewResponse, DEFAULT_SRS_SETTINGS } = require('./src/core/algorithms/SpacedRepetitionAlgorithm.ts');

// Create algorithm instance
const srsAlgorithm = new SpacedRepetitionAlgorithm();

console.log('=== 수정된 Spaced Repetition Algorithm 테스트 ===');
console.log('기본 설정:', DEFAULT_SRS_SETTINGS);

console.log('\n=== 처음 학습하는 단어 테스트 (Embryo 케이스) ===');

// 새로운 단어 (Embryo와 같은 경우)
console.log('\n1. 새로운 단어 - Hard 응답');
const result1 = srsAlgorithm.schedule(ReviewResponse.Hard);
console.log('결과:', {
    interval: result1.interval + '일',
    ease: result1.ease,
    repetition: result1.repetition
});

console.log('\n2. 새로운 단어 - Good 응답 (문제가 있던 케이스)');
const result2 = srsAlgorithm.schedule(ReviewResponse.Good);
console.log('결과:', {
    interval: result2.interval + '일',
    ease: result2.ease, 
    repetition: result2.repetition
});

console.log('\n3. 새로운 단어 - Easy 응답');
const result3 = srsAlgorithm.schedule(ReviewResponse.Easy);
console.log('결과:', {
    interval: result3.interval + '일',
    ease: result3.ease,
    repetition: result3.repetition
});

console.log('\n=== 기대 결과 ===');
console.log('Hard: 1일 (수정 전후 동일)');
console.log('Good: 1일 (수정 전: 2일 → 수정 후: 1일)');
console.log('Easy: 2일 (수정 전: 3일 → 수정 후: 2일)');