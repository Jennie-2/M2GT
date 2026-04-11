# Gym Benchmark - Modularized PWA

## 📁 프로젝트 구조

```
benchmark-app/
├── index.html          # 메인 HTML 파일
├── manifest.json       # PWA 매니페스트
├── css/
│   └── styles.css      # 애플리케이션 스타일시트
├── js/
│   └── app.js          # 메인 JavaScript 애플리케이션
└── assets/             # 정적 자산 디렉토리
    └── (아이콘, 이미지 등)
```

## 🎯 프로젝트 개요

이 프로젝트는 원래 단일 HTML 파일로 되어 있던 "Gym Benchmark" PWA 애플리케이션을 모듈화된 구조로 재구성한 것입니다.

### 주요 기능
- PWA(Progressive Web App) 지원
- 짐 회원 관리
- WOD(Workout of the Day) 추적
- 리더보드 및 순위 기능
- 오프라인 지원 (IndexedDB/localStorage)

## 📝 파일 설명

### index.html
- PWA 메타 태그 설정
- Manifest 링크
- 외부 CSS 및 JavaScript 참조
- 앱 로딩 화면 포함

### manifest.json
- 앱 이름: "Gym Benchmark"
- 시작 URL: "./"
- 표시 모드: standalone
- 테마 색상: #3182F6 (파란색)
- 배경 색상: #F2F4F6 (밝은 회색)

### css/styles.css (245 줄)
- 완전한 UI 스타일시트
- 반응형 디자인 (모바일 우선)
- 레이아웃: Flexbox & Grid
- 애니메이션 포함
- 색상 스킴: 파란색 메인, 밝은 배경

### js/app.js
- 메인 애플리케이션 로직
- 회원 관리
- WOD 트래킹
- UI 이벤트 핸들링

## 🚀 사용 방법

### 설치
```bash
# 프로젝트 디렉토리로 이동
cd benchmark-app

# (선택사항) 로컬 서버 실행
python -m http.server 8000
# 또는
npx http-server
```

### 브라우저에서 접근
```
http://localhost:8000
```

## 🔧 기술 스택
- HTML5
- CSS3 (모던 레이아웃)
- Vanilla JavaScript (ES6+)
- PWA APIs (Web App Manifest, Service Worker 호환)

## 📱 기능 특징

### 사용자 인터페이스
- 네비게이션 바
- 로그인 페이지
- 회원 컨테이너
- 액션 카드
- 모달 팝업 (PIN 입력, 시간 선택)
- 토스트 알림
- 리더보드 페이지
- 순위 페이지

### 데이터 관리
- 로컬 저장소 활용
- 회원 정보 관리
- WOD 기록
- 점수 및 순위 추적

## 📋 다음 단계

- [ ] Service Worker 구현 (오프라인 지원)
- [ ] IndexedDB 마이그레이션 (복잡한 데이터)
- [ ] 이미지 최적화 (아이콘 다운로드)
- [ ] 테스트 작성
- [ ] 배포 설정

## 🎨 커스터마이제이션

### 색상 변경
`manifest.json`의 `theme_color`와 `background_color`를 수정하세요.

### 폰트 변경
`css/styles.css`의 `font-family`를 수정하세요 (현재: SUIT Variable).

### 앱 이름 변경
`manifest.json`의 `name`과 `short_name`을 수정하세요.

## 📄 라이선스

이 프로젝트는 원본 Gym Benchmark 애플리케이션을 모듈화한 버전입니다.

## 👨‍💻 개발자 노트

### 모듈화 구조의 이점
1. **유지보수 용이**: 각 파일이 단일 책임을 가짐
2. **재사용성**: CSS와 HTML 분리로 재사용 가능
3. **확장성**: 새로운 기능 추가가 간단함
4. **성능**: 캐싱과 최적화 가능성 증대

### 추가 개선 사항
- [ ] TypeScript 전환
- [ ] 모듈 번들러 도입 (Webpack/Vite)
- [ ] 상태 관리 라이브러리 (Redux/Zustand)
- [ ] 컴포넌트 라이브러리 구축
