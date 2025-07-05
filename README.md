# English Vocabulary Learning Plugin for Obsidian

[한국어 설명](https://github.com/shinners1/obsidian-english-vocabulary?tab=readme-ov-file#obsidian-%EC%98%81%EC%96%B4-%EB%8B%A8%EC%96%B4-%ED%95%99%EC%8A%B5-%ED%94%8C%EB%9F%AC%EA%B7%B8%EC%9D%B8)

An AI-powered English vocabulary learning plugin for Obsidian that uses spaced repetition and flashcards to help you memorize English words effectively.

## ✨ Features

### 🧠 Smart Learning System
- **SM-2 Spaced Repetition Algorithm**: Scientifically proven method for long-term retention
- **AI-Powered Content**: Automatic example sentences and definitions using LLM services (OpenAI, Anthropic, Google AI)
- **3-Level Assessment**: Hard/Good/Easy evaluation system for personalized learning curves

### 🎯 Learning Tools
- **Flashcard Interface**: Anki-style learning experience with two-stage reveal
- **TTS Pronunciation**: Multiple text-to-speech providers for correct pronunciation
- **Multiple Vocabulary Books**: Organize words by topics, difficulty, or personal preference
- **Progress Tracking**: Detailed statistics including streak days, success rate, and learning analytics

### 🔧 Technical Features
- **Markdown-based Storage**: All vocabulary data stored as readable markdown files
- **Clean Architecture**: Well-structured, maintainable codebase following SOLID principles
- **Load Balancing**: Distributes review sessions evenly to prevent overwhelming study days
- **Secure API Storage**: All API keys are encrypted before storage

## 🚀 Quick Start

1. Install the plugin from Obsidian Community Plugins
2. Configure your AI API key in settings (optional but recommended)
3. Create your first vocabulary book or use the default one
4. Add words manually or let AI generate content
5. Start learning with the flashcard system!

## 📖 Usage Guide

### Basic Learning Flow
1. **Add Words**: Click "Add Words" to add new vocabulary to your books
2. **Study Mode**: Start learning session to see new words
3. **Review Mode**: The SM-2 algorithm automatically schedules reviews
4. **Track Progress**: Monitor your learning statistics and streaks

### Available Commands
- `English Vocabulary: Start Learning` - Begin a flashcard learning session
- `English Vocabulary: View Vocabulary Books` - Manage your word collections
- `English Vocabulary: Add Words` - Add new vocabulary to current book
- `English Vocabulary: Review Statistics` - View your learning progress
- `English Vocabulary: Settings` - Configure plugin options

### Learning Interface
1. **First Stage**: Shows the English word, pronunciation, similar words, and example sentences
2. **Second Stage**: Reveals meanings in your native language and translated examples
3. **Assessment**: Rate your recall as Hard/Good/Easy to optimize future reviews

## ⚙️ Configuration

### AI Integration (Optional but Recommended)
Configure AI services for enhanced learning experience:

- **OpenAI**: GPT models for high-quality content generation
- **Anthropic Claude**: Advanced AI with nuanced understanding
- **Google AI**: Gemini models for diverse content

### TTS Settings
- **Voice Selection**: Choose from available system voices
- **Speech Rate**: Adjust pronunciation speed (0.5 - 2.0)
- **Provider Options**: 
  - Browser TTS (built-in)
  - Google Cloud TTS (requires API)
  - Chatterbox TTS

### Learning Settings
- **Daily Goal**: Set target words to learn per day
- **Review Batch Size**: Number of cards per review session
- **Auto-play Audio**: Enable automatic pronunciation

## 🧪 Spaced Repetition Algorithm

This plugin implements the **SM-2 (SuperMemo-2) algorithm**, the gold standard for spaced repetition:

### Mathematical Foundation
- **E-Factor Update**: `EF_new = EF_old + (0.1 - (3-q)×(0.08 + (3-q)×0.02))`
- **Review Intervals**: 
  - First review: 1 day
  - Second review: 6 days
  - Subsequent: `I_n = I_(n-1) × EF_new`
- **Quality Scores**: 
  - Hard (1): Difficult recall, resets interval
  - Good (2): Successful recall with effort
  - Easy (3): Perfect recall

### Load Balancing
The plugin intelligently distributes reviews across days to prevent overwhelming study sessions:
- Short intervals (≤21 days): ±1 day fuzzing
- Medium intervals (≤180 days): ±5% fuzzing
- Long intervals (>180 days): ±2.5% fuzzing

## 🏗️ Architecture

```
src/
├── core/ # Business logic & algorithms
├── features/ # Feature modules
├── infrastructure/ # External services
└── shared/ # Common utilities
```

Built with Clean Architecture principles for maintainability and extensibility:

## 🔒 Privacy & Security

- **Local Storage**: All vocabulary data stored locally in your vault
- **Encrypted API Keys**: Sensitive credentials are encrypted
- **No Telemetry**: No usage data is collected or transmitted
- **Open Source**: Full source code available for review

## 📊 Data Format

Vocabulary is stored in markdown files with frontmatter:

```markdown
---
bookId: default
name: "My Vocabulary Book"
wordCount: 42
---

### word

**pronunciation:** /wɜːrd/
**meanings:**
- a unit of language
- a promise or assurance

**examples:**
- Keep your word.
- A word to the wise is sufficient.
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/shinners1/obsidian-english-vocabulary

# Install dependencies
npm install

# Build the plugin
npm run build

# Run in development mode
npm run dev
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- SM-2 Algorithm by Piotr Wozniak (SuperMemo)
- Inspired by Anki's spaced repetition system
- Built for the amazing Obsidian community
- Special thanks to all contributors and testers

## 📮 Support

- **Issues**: [GitHub Issues](https://github.com/shinners1/obsidian-english-vocabulary/issues)
- **Discussions**: [GitHub Discussions](https://github.com/shinners1/obsidian-english-vocabulary/discussions)
- **Email**: obsidian.voca@gmail.com

---

If you find this plugin helpful, please consider:
- ⭐ Starring the repository
- 💝 [Buy Me a Coffee](https://buymeacoffee.com/obsidianvop)
- 📢 Sharing with other English learners

---

# Obsidian 영어 단어 학습 플러그인

간격 반복과 플래시카드를 사용하여 영어 단어를 효과적으로 암기할 수 있도록 도와주는 AI 기반 Obsidian 영어 단어 학습 플러그인입니다.

## ✨ 주요 기능

### 🧠 스마트 학습 시스템
- **SM-2 간격 반복 알고리즘**: 장기 기억 보존을 위한 과학적으로 입증된 방법
- **AI 기반 콘텐츠**: LLM 서비스(OpenAI, Anthropic, Google AI)를 사용한 자동 예문 및 정의 생성
- **3단계 평가**: 개인화된 학습 곡선을 위한 어려움/보통/쉬움 평가 시스템

### 🎯 학습 도구
- **플래시카드 인터페이스**: Anki 스타일 학습 경험
- **TTS 발음**: 단어 이해를 돕기 위한 텍스트 음성 변환 
- **다중 단어장**: 주제, 난이도 등 여러 단어장 생성 및 관리
- **진도 추적**: 연속 학습일, 성공률 및 학습 분석을 포함한 상세 통계

### 🔧 특징
- **마크다운 기반 저장**: 모든 단어 데이터를 읽기 가능한 마크다운 파일로 저장
- **로드 밸런싱**: 과도한 학습량을 방지하기 위해 복습 세션을 균등하게 분배
- **보안 API 저장**: 모든 API 키는 암호화되어 저장


## 🚀 빠른 시작

1. Obsidian 커뮤니티 플러그인에서 플러그인 설치
2. 설정에서 AI API 키 구성 (선택사항이지만 권장)
3. 첫 번째 단어장 생성 또는 기본 단어장 사용
4. 수동으로 단어 추가 또는 AI가 콘텐츠 생성하도록 설정
5. 플래시카드 시스템으로 학습 시작!

## 📖 사용 가이드

### 기본 학습 흐름
1. **단어 추가**: "단어 추가"를 클릭하여 단어장에 새 단어 추가
2. **학습 모드**: 새로운 단어를 보기 위한 학습 세션 시작
3. **복습 모드**: SM-2 알고리즘이 자동으로 복습 일정 계획
4. **진도 추적**: 학습 통계 및 연속 기록 모니터링

### 사용 가능한 명령어
- `English Vocabulary: 단어 학습 시작` - 플래시카드 학습 세션 시작
- `English Vocabulary: 단어장 보기` - 단어 모음 관리
- `English Vocabulary: 단어 추가` - 현재 단어장에 새 단어들 추가

### 학습 인터페이스
1. **첫 번째 단계**: 영어 단어, 발음, 유사 단어 및 예문 표시
2. **두 번째 단계**: 모국어 의미 및 번역된 예문 공개
3. **평가**: 향후 복습을 최적화하기 위해 기억 정도를 어려움/보통/쉬움으로 평가

## ⚙️ 설정

향상된 학습 경험을 위한 AI 서비스 구성:

- OpenAI ChatGPT
- Anthropic Claude
- Google Gemini

### TTS 설정
- **음성 선택**: 사용 가능한 시스템 음성 중에서 선택
- **발화 속도**: 발음 속도 조정 (0.5 - 2.0)
- **제공업체 옵션**: 
  - Google Cloud TTS (API 필요)
  - Chatterbox TTS

### 학습 설정
- **일일 목표**: 하루에 학습할 목표 단어 수 설정
- **복습 배치 크기**: 복습 세션당 카드 수
- **자동 오디오 재생**: 자동 발음 듣기

## 🧪 간격 반복 알고리즘

이 플러그인은 간격 반복의 표준인 **SM-2 (SuperMemo-2) 알고리즘**을 구현합니다:


- **E-Factor 업데이트**: `EF_new = EF_old + (0.1 - (3-q)×(0.08 + (3-q)×0.02))`
- **복습 간격**: 
  - 첫 번째 복습: 1일
  - 두 번째 복습: 6일
  - 이후: `I_n = I_(n-1) × EF_new`
- **품질 점수**: 
  - 어려움 (1): 어려운 기억, 간격 재설정
  - 보통 (2): 노력을 통한 성공적인 기억
  - 쉬움 (3): 완벽한 기억

### 로드 밸런싱
플러그인은 과도한 학습 세션을 방지하기 위해 복습을 여러 날에 걸쳐 지능적으로 분배합니다:
- 짧은 간격 (≤21일): ±1일 퍼징
- 중간 간격 (≤180일): ±5% 퍼징
- 긴 간격 (>180일): ±2.5% 퍼징

## 🏗️ 아키텍처

유지보수성과 확장성을 위한 클린 아키텍처 원칙으로 구축:

```
src/
├── core/ # 비즈니스 로직 및 알고리즘
├── features/ # 기능 모듈
├── infrastructure/ # 외부 서비스
└── shared/ # 공통 유틸리티
```

## 🔒 개인정보 보호 및 보안

- **로컬 저장**: 모든 단어 데이터가 볼트에 로컬로 저장
- **암호화된 API 키**: 민감한 자격 증명이 암호화됨
- **텔레메트리 없음**: 사용 데이터가 수집되거나 전송되지 않음
- **오픈 소스**: 검토를 위한 전체 소스 코드 제공

## 📊 데이터 형식

단어는 프론트매터가 있는 마크다운 파일에 저장됩니다:

```markdown
---
bookId: default
name: "내 단어장"
wordCount: 42
---

### word

**pronunciation:** /wɜːrd/
**meanings:**
- 언어의 단위
- 약속이나 보증

**examples:**
- Keep your word. (약속을 지켜라)
  - A word to the wise is sufficient. (현명한 자에게는 한 마디면 충분하다)
```

## 🤝 기여하기

기여를 환영합니다! Pull Request를 자유롭게 제출해 주세요. 주요 변경사항의 경우, 먼저 이슈를 열어 변경하고자 하는 내용에 대해 논의해 주세요.

### 개발 설정
```bash
# 저장소 복제
git clone https://github.com/shinners1/obsidian-english-vocabulary

# 의존성 설치
npm install

# 플러그인 빌드
npm run build

# 개발 모드 실행
npm run dev
```

## 📄 라이선스

MIT 라이선스 - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요

## 🙏 감사의 말

- Piotr Wozniak(SuperMemo)의 SM-2 알고리즘
- Anki의 간격 반복 시스템에서 영감을 받음

## 📮 지원

- **이슈**: [GitHub Issues](https://github.com/shinners1/obsidian-english-vocabulary/issues)
- **토론**: [GitHub Discussions](https://github.com/shinners1/obsidian-english-vocabulary/discussions)
- **이메일**: obsidian.voca@gmail.com

---

이 플러그인이 도움이 되었다면 :
- ⭐ 별 클릭해주기
- 💝 [Buy me a coffee](https://buymeacoffee.com/obsidianvop)
- 📢 다른 사람들에게 본 플러그인 공유하기