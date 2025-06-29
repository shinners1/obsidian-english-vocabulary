# English Vocabulary Learning Plugin for Obsidian

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

Built with Clean Architecture principles for maintainability and extensibility:

```
src/
├── core/               # Business logic & algorithms
├── features/           # Feature modules
├── infrastructure/     # External services
└── shared/            # Common utilities
```

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
- **Email**: shinners1@github.com

---

If you find this plugin helpful, please consider:
- ⭐ Starring the repository
- 💝 [Sponsoring development](https://github.com/sponsors/shinners1)
- 📢 Sharing with other English learners

