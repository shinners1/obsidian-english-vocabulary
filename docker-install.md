# Docker 설치 매뉴얼

## 📋 개요
이 매뉴얼은 English Vocabulary Learning 플러그인을 Docker를 통해 웹 서비스로 실행하는 방법을 설명합니다.

## 🔧 사전 요구사항

### 1. Docker 설치
- **Windows**: [Docker Desktop for Windows](https://docs.docker.com/desktop/windows/install/)
- **macOS**: [Docker Desktop for Mac](https://docs.docker.com/desktop/mac/install/)
- **Linux**: [Docker Engine](https://docs.docker.com/engine/install/)

### 2. Docker Compose 설치
- Docker Desktop 사용 시 자동으로 포함됨
- Linux에서는 별도 설치 필요: [Docker Compose 설치 가이드](https://docs.docker.com/compose/install/)

## 🚀 설치 및 실행

### 1. 프로젝트 클론 또는 다운로드
```bash
# Git을 사용하는 경우
git clone https://github.com/shinners1/obsidian-english-vocabulary
cd obsidian-english-vocabulary

# 또는 직접 다운로드한 경우
cd /path/to/obsidian-english-vocabulary
```

### 2. Docker 환경 확인
```bash
# Docker 버전 확인
docker --version

# Docker Compose 버전 확인
docker-compose --version
```

### 3. 컨테이너 빌드 및 실행
```bash
# 백그라운드에서 실행
docker-compose up -d --build

# 또는 포그라운드에서 실행 (로그 확인 가능)
docker-compose up --build
```

### 4. 웹 애플리케이션 접속
브라우저에서 다음 URL로 접속:
```
http://localhost:8080
```

## 📂 파일 구조
실행에 필요한 파일들:
```
obsidian-english-vocabulary/
├── Dockerfile              # Docker 이미지 빌드 설정
├── docker-compose.yml      # 컨테이너 오케스트레이션
├── .dockerignore           # Docker 빌드 시 제외할 파일들
├── package.json            # Node.js 의존성 및 스크립트
├── web-server.js           # Express.js 웹 서버
├── index.html              # 웹 UI 인터페이스
├── esbuild.config.mjs      # 빌드 설정
├── src/                    # TypeScript 소스 코드
├── styles.css              # 스타일시트
└── data/                   # 데이터 저장소 (자동 생성)
```

## 🛠️ 주요 명령어

### 컨테이너 관리
```bash
# 컨테이너 시작
docker-compose start

# 컨테이너 중지
docker-compose stop

# 컨테이너 재시작
docker-compose restart

# 컨테이너 및 이미지 삭제
docker-compose down --rmi all

# 로그 확인
docker-compose logs -f
```

### 개발 모드 실행
```bash
# 개발 모드로 실행 (코드 변경 시 자동 재시작)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## 🔧 환경 설정

### 포트 변경
`docker-compose.yml` 파일에서 포트를 변경할 수 있습니다:
```yaml
services:
  obsidian-vocabulary-web:
    ports:
      - "8080:8080"  # 호스트포트:컨테이너포트
```

### 데이터 영속성
볼륨 마운트를 통해 데이터가 보존됩니다:
```yaml
volumes:
  - ./data:/app/data  # 로컬 ./data 폴더와 연결
```

## 🐛 트러블슈팅

### 문제 1: 포트 충돌
**증상**: `Error: listen EADDRINUSE :::8080`
**해결**: 
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :8080  # macOS/Linux
netstat -ano | findstr :8080  # Windows

# 다른 포트 사용 (docker-compose.yml 수정)
ports:
  - "8081:8080"
```

### 문제 2: Docker 빌드 실패
**증상**: `npm ci` 실행 중 오류
**해결**:
```bash
# Docker 캐시 삭제 후 재빌드
docker-compose down
docker system prune -a
docker-compose up --build --no-cache
```

### 문제 3: 웹 페이지 접속 불가
**증상**: 브라우저에서 접속 실패
**해결**:
```bash
# 컨테이너 상태 확인
docker-compose ps

# 컨테이너 로그 확인
docker-compose logs obsidian-vocabulary-web

# 네트워크 확인
docker network ls
```

### 문제 4: 빌드 시간이 너무 오래 걸림
**해결**:
```bash
# .dockerignore 파일 확인
# node_modules, .git 등이 제외되어 있는지 확인

# 멀티스테이지 빌드 활용 (고급 사용자)
```

## 🔄 업데이트 방법

### 1. 코드 업데이트 후 재배포
```bash
# 최신 코드 받기
git pull origin main

# 이미지 재빌드 및 재실행
docker-compose down
docker-compose up --build -d
```

### 2. 의존성 업데이트
```bash
# package.json 수정 후
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📊 성능 모니터링

### 리소스 사용량 확인
```bash
# 컨테이너 리소스 사용량
docker stats

# 디스크 사용량
docker system df
```

### 헬스체크
컨테이너 상태는 자동으로 모니터링됩니다:
```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## 📝 추가 정보

### API 엔드포인트
- `GET /` - 메인 웹 페이지
- `GET /api/vocabulary` - 단어 데이터 조회
- `POST /api/vocabulary` - 단어 데이터 저장

### 개발 환경 구축
로컬 개발을 위한 설정:
```bash
# Node.js 환경에서 직접 실행
npm install
npm run build
npm run web

# 개발 모드 (코드 변경 감지)
npm run web:dev
```

## 🆘 지원

문제가 발생하면 다음을 확인하세요:
1. Docker 및 Docker Compose 버전
2. 포트 충돌 여부
3. 디스크 공간 충분 여부
4. 방화벽 설정
5. 컨테이너 로그

---

**Version**: 1.0  
**Last Updated**: 2024-01-01  
**Author**: Shinners