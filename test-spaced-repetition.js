// Simple test script to verify spaced repetition functionality
// This is a basic test to ensure the core algorithm works

import { SpacedRepetitionAlgorithm, ReviewResponse } from './src/core/algorithms/SpacedRepetitionAlgorithm.js';

// Test basic algorithm functionality
console.log('Testing Spaced Repetition Algorithm...');

const algorithm = new SpacedRepetitionAlgorithm();

// Test new card
console.log('\n1. Testing new card:');
const newCardResult = algorithm.schedule(ReviewResponse.Good);
console.log('New card result:', newCardResult);

// Test second review
console.log('\n2. Testing second review (Good):');
const secondResult = algorithm.schedule(ReviewResponse.Good, {
    dueDate: newCardResult.dueDate,
    interval: newCardResult.interval,
    ease: newCardResult.ease,
    reviewCount: 1,
    lapseCount: 0,
    delayedDays: 0
});
console.log('Second review result:', secondResult);

// Test hard response
console.log('\n3. Testing hard response:');
const hardResult = algorithm.schedule(ReviewResponse.Hard, {
    dueDate: secondResult.dueDate,
    interval: secondResult.interval,
    ease: secondResult.ease,
    reviewCount: 2,
    lapseCount: 0,
    delayedDays: 0
});
console.log('Hard response result:', hardResult);

// Test easy response
console.log('\n4. Testing easy response:');
const easyResult = algorithm.schedule(ReviewResponse.Easy, {
    dueDate: hardResult.dueDate,
    interval: hardResult.interval,
    ease: hardResult.ease,
    reviewCount: 3,
    lapseCount: 1,
    delayedDays: 0
});
console.log('Easy response result:', easyResult);

console.log('\n✅ Spaced Repetition Algorithm test completed successfully!');