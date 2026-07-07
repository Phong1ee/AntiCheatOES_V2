# Question Pool System - Randomization Per Student

## Overview

The Question Pool System allows teachers to configure exams where each student receives a unique set of questions while maintaining consistency in:
- Number of questions from each knowledge domain
- Distribution of difficulty levels
- Total number of questions
- Overall exam structure

## How It Works

### 1. Pool Configuration

Teachers configure a question pool by specifying:
- **Subject Filter**: Select questions from specific subject or all subjects
- **Knowledge Domain Distribution**: Define how many questions from each knowledge domain
- **Difficulty Distribution**: Specify easy/medium/hard questions per domain
- **Total Questions**: Automatically calculated based on configuration

### 2. Question Selection Process

When a student starts the exam:
1. System uses student ID as a seed for random number generator
2. For each rule in the pool configuration:
   - Filter available questions by knowledge domain and difficulty
   - Randomly select required number of questions using seeded RNG
3. Combine all selected questions
4. Shuffle the final question set
5. Present to student

### 3. Key Features

#### Consistent Distribution
All students receive:
- Same number of questions per knowledge domain
- Same difficulty distribution
- Same total number of questions

#### Unique Question Sets
Each student receives:
- Different specific questions
- Different question order
- Randomized from the same pool

#### Reproducibility
- Uses seeded random number generation
- Same student ID always generates same question set
- Allows for consistent grading and review

## Configuration Matrix

The Pool Configuration Builder uses a matrix approach:

```
Knowledge Domain | Easy | Medium | Hard | Subtotal
-------------------------------------------------
Database Design  |  3   |   2    |  1   |    6
SQL Queries      |  2   |   3    |  1   |    6
Normalization    |  1   |   2    |  2   |    5
Transactions     |  1   |   1    |  2   |    4
-------------------------------------------------
Total            |  7   |   8    |  6   |   21
```

## Example Scenario

### Pool Setup
- **Question Bank**: 40 questions in Database Systems
- **Exam Configuration**: Draw 20 questions
- **Distribution**:
  - Database Design: 3 easy, 2 medium, 1 hard (6 total)
  - SQL Queries: 2 easy, 3 medium, 1 hard (6 total)
  - Normalization: 1 easy, 2 medium, 2 hard (5 total)
  - Transactions: 1 easy, 1 medium, 1 hard (3 total)

### Student 1 Receives
Questions: Q1, Q5, Q8, Q12, Q15, Q18, Q22, Q25, Q28, Q31, Q34, Q37, Q40, Q3, Q7, Q11, Q14, Q19, Q23, Q27

### Student 2 Receives
Questions: Q2, Q4, Q9, Q13, Q16, Q20, Q24, Q26, Q29, Q32, Q35, Q38, Q6, Q10, Q17, Q21, Q30, Q33, Q36, Q39

Both students have:
- 6 questions from Database Design (3 easy, 2 medium, 1 hard)
- 6 questions from SQL Queries (2 easy, 3 medium, 1 hard)
- 5 questions from Normalization (1 easy, 2 medium, 2 hard)
- 3 questions from Transactions (1 easy, 1 medium, 1 hard)
- **Total: 20 questions**

## Benefits

### For Teachers
- **Reduce Cheating**: Each student has different questions
- **Fair Assessment**: All students tested on same topics with same difficulty
- **Flexible Configuration**: Easy to adjust distribution based on curriculum
- **Time Saving**: No need to create multiple exam versions manually
- **Large Question Pools**: Utilize entire question bank efficiently

### For Students
- **Fair Evaluation**: Same difficulty level and topic coverage
- **Reduced Anxiety**: Less pressure from peers having different questions
- **Consistent Experience**: Same exam structure for everyone

## Best Practices

### Pool Size
- Recommended: Pool should be at least 2x the number of questions drawn
- Example: If drawing 20 questions, have at least 40 in pool
- Ensures sufficient randomization between students

### Distribution Balance
- **Balanced**: Equal questions from each domain
- **Weighted**: More questions from important topics
- **Progressive**: More hard questions for advanced classes

### Quality Control
- Review all questions in pool before exam
- Ensure consistent difficulty ratings
- Verify correct answers are properly set
- Test point values are appropriate

## Technical Implementation

### Seeded Random Number Generator
```javascript
const seededRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
};
```

### Question Selection Algorithm
1. Initialize RNG with student ID as seed
2. For each pool rule (domain + difficulty):
   - Get all matching questions
   - Shuffle using seeded RNG
   - Take first N questions
3. Combine all selected questions
4. Final shuffle of combined set
5. Return question array

## Comparison with Other Modes

### Manual Selection
- Teacher selects specific questions
- All students receive same questions in same order
- Use for: Specific assessments, review quizzes

### Fixed Randomization
- System randomly selects questions once
- All students receive same questions in random order
- Use for: Standard exams with shuffle enabled

### Pool Configuration (Recommended)
- System generates unique question set per student
- Different questions, same distribution
- Use for: Large classes, high-stakes exams, cheating prevention

## Future Enhancements

### Planned Features
- [ ] Question difficulty auto-adjustment based on student performance
- [ ] Topic mastery tracking across multiple exams
- [ ] Adaptive testing (difficulty adjusts during exam)
- [ ] Question usage analytics (frequency, performance)
- [ ] Export pool configuration templates
- [ ] Import pools from standardized question banks

### Advanced Configuration
- [ ] Prerequisite question chains
- [ ] Mutual exclusion rules (don't show related questions together)
- [ ] Time weighting per question
- [ ] Point value customization per rule

## Troubleshooting

### Issue: Not Enough Questions
**Problem**: Pool has fewer questions than configured to draw
**Solution**: 
- Reduce number of questions in configuration
- Add more questions to question bank
- Adjust distribution to available questions

### Issue: Unbalanced Difficulty
**Problem**: Too many easy or hard questions
**Solution**:
- Review difficulty ratings in question bank
- Adjust pool configuration distribution
- Add more questions of needed difficulty

### Issue: Same Questions for Multiple Students
**Problem**: Small pool causes repetition
**Solution**:
- Expand question bank (recommended 2-3x draw amount)
- Review seeded RNG implementation
- Check student ID uniqueness

## Support

For questions or issues with the Question Pool System:
- Review this documentation
- Check question bank has sufficient questions
- Verify pool configuration totals
- Use Student Preview feature to test before publishing exam
