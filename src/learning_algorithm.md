
## SM-2 알고리즘 개요

1. **학습 품질(quality)**  
   학습자가 회상한 뒤 아래 세 가지로 평가합니다.  
   - 1 (hard): 매우 어렵게 회상하거나 거의 실패에 가까운 경우  
   - 2 (good): 약간의 노력을 들여 회상한 경우  
   - 3 (easy): 쉽게 완전 회상한 경우  

2. **반복 횟수(repetition count)**  
   - \(q \ge 2\) (good 또는 easy)일 때만 `repetition`을 1씩 증가시킵니다.  
   - \(q = 1\) (hard)이면 `repetition`을 0으로 리셋하고 즉시 다음 복습을 계획합니다.

3. **난이도 계수(E-Factor)**  
   각 카드의 “망각 속도”를 나타내는 계수로, 초기값은 보통 \(EF_0 = 2.5\)입니다.  
   \[
     EF_{\text{new}}
     = EF_{\text{old}}
     + \Bigl(0.1 \;-\;(3 - q)\times\bigl(0.08 + (3 - q)\times0.02\bigr)\Bigr)
     \quad,\; EF_{\text{new}} \ge 1.3
   \]
   여기서 \(q\in\{1,2,3\}\)이며, 계산 결과가 1.3 미만이면 1.3으로 고정합니다.

4. **복습 간격(interval)**  
   연속 성공 회상 횟수 \(n = \text{repetition}\)에 따라 다음 복습까지 대기일을 결정합니다.  
   \[
   I_n =
   \begin{cases}
     1, & n = 1,\\
     6, & n = 2,\\
     I_{n-1} \times EF_{\text{new}}, & n \ge 3.
   \end{cases}
   \]
   계산된 간격은 소수점 반올림 후 “일(day)” 단위로 사용합니다.


## 1. 평가 척도

- **1 (hard)**
- **2 (good)**
- **3 (easy)**

학습자가 카드를 회상한 뒤 이 셋 중 하나를 선택해 평가합니다.

---

## 2. 난이도 계수(E-Factor) 업데이트 공식

\[
EF_{\text{new}}
= EF_{\text{old}}
+ \Bigl(0.1 \;-\;(3 - q)\times\bigl(0.08 + (3 - q)\times0.02\bigr)\Bigr)
\]
- \(q\in\{1,2,3\}\)
- 최소값을 \(1.3\)으로 제한:  
  \[
    EF_{\text{new}} = \max(1.3,\;EF_{\text{new}})
  \]

---

## 3. 반복 횟수(repetition) 업데이트 규칙

- \(q \ge 2\) (good 또는 easy) 일 때  
  \[
    \text{repetition} \leftarrow \text{repetition} + 1
  \]
- \(q = 1\) (hard) 일 때  
  \[
    \text{repetition} \leftarrow 0
  \]

---

## 4. 다음 복습 간격(interval) 계산

\[
I_n =
\begin{cases}
1, & n = 1,\\
6, & n = 2,\\
I_{n-1} \times EF_{\text{new}}, & n \ge 3.
\end{cases}
\]
- \(n\)은 현재까지 성공 회상의 연속 횟수(=repetition)  
- 계산 후 소수점은 반올림하여 일수(day)로 사용

---

## 5. 적용 가이드 & 예시

### 5.1 초기 설정
- 모든 카드의 초깃값:  
  - \(EF_0 = 2.5\)  
  - \(\text{repetition}_0 = 0\)  
  - 다음 복습 간격은 바로 “1일 후”로 설정

---

### 5.2 예시 상황 1: “easy” 평가 (q=3)

- **이전 상태**:  
  - \(EF_{\text{old}} = 2.5\)  
  - \(\text{repetition}_{\text{old}} = 2\)  
  - \(I_{\text{old}} = 6\)

- **평가**: \(q = 3\) (easy)  
1. 난이도 계수 업데이트  
   \[
   \Delta = 0.1 - (3-3)(0.08 + (3-3)\times0.02) = 0.1
   \]
   \[
   EF_{\text{new}} = 2.5 + 0.1 = 2.6
   \]
2. repetition 증가  
   \(\text{repetition}_{\text{new}} = 2 + 1 = 3\)  
3. 다음 간격  
   \[
   I_3 = I_2 \times EF_{\text{new}} = 6 \times 2.6 = 15.6 \approx 16\text{일}
   \]

---

### 5.3 예시 상황 2: “good” 평가 (q=2)

- **이전 상태**:  
  - \(EF_{\text{old}} = 2.6\)  
  - \(\text{repetition}_{\text{old}} = 3\)  
  - \(I_{\text{old}} = 16\)

- **평가**: \(q = 2\) (good)  
1. 난이도 계수 업데이트  
   \[
   \Delta = 0.1 - (3-2)(0.08 + (3-2)\times0.02) = 0.1 - 0.1 = 0
   \]
   \[
   EF_{\text{new}} = 2.6 + 0 = 2.6
   \]
2. repetition 증가  
   \(\text{repetition}_{\text{new}} = 3 + 1 = 4\)  
3. 다음 간격  
   \[
   I_4 = I_3 \times EF_{\text{new}} = 16 \times 2.6 = 41.6 \approx 42\text{일}
   \]

---

### 5.4 예시 상황 3: “hard” 평가 (q=1)

- **이전 상태**:  
  - \(EF_{\text{old}} = 2.6\)  
  - \(\text{repetition}_{\text{old}} = 4\)  
  - \(I_{\text{old}} = 42\)

- **평가**: \(q = 1\) (hard)  
1. 난이도 계수 업데이트  
   \[
   \Delta = 0.1 - (3-1)(0.08 + (3-1)\times0.02)
   = 0.1 - 2\times0.12 = 0.1 - 0.24 = -0.14
   \]
   \[
   EF' = 2.6 - 0.14 = 2.46
   \quad(\ge1.3\text{이므로 허용})
   \]
2. repetition 리셋  
   \(\text{repetition}_{\text{new}} = 0\)  
3. 다음 간격  
   \[
   I_1 = 1\text{일}
   \]

---

이 가이드를 따라 매 복습마다 **1, 2, 3** 평가를 기록하고, 위 순서대로 EF와 repetition, interval을 업데이트하세요.  
장기적으로 각 카드의 복습 타이밍이 자동으로 최적화됩니다.
