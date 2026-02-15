# AquariumApp - 나만의 수족관

인터랙티브 수족관 iOS 앱. 커스텀 이모지/사진 캐릭터가 헤엄치고, 시간대에 따라 배경이 변합니다.

## 기능

### A. 헤엄치는 애니메이션 (핵심)
- 60fps 부드러운 수영 애니메이션
- 자연스러운 물결 효과 (상하 흔들림)
- 벽에 닿으면 방향 전환 + 좌우 반전
- 랜덤 방향 변경으로 자연스러운 움직임

### B. 시간대별 배경 변화
- **새벽** (05~07): 따뜻한 오렌지/핑크
- **아침** (07~12): 밝은 하늘색
- **오후** (12~17): 진한 파란색
- **저녁** (17~20): 보라/주황 노을
- **밤** (20~05): 어두운 남색 + 별

### C. 터치 인터랙션
- **빈 공간 탭**: 거품 생성 (위로 떠오름)
- **캐릭터 탭**: 통통 바운스 + 거품 + 방향 변경

### 커스텀 캐릭터
- **이모지**: 바다 생물 18종 + 재미 이모지 16종
- **사진**: 사진첩에서 선택해서 원형으로 수족관에 추가
- 캐릭터별 크기/속도 랜덤 설정
- 추가/삭제 자유

## Xcode 세팅 방법

1. **Xcode 열기** → `File` → `New` → `Project`
2. **iOS** → **App** 선택
3. 설정:
   - Product Name: `AquariumApp`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Minimum Deployments: **iOS 16.0**
4. 프로젝트 생성 후, 기본 파일들 삭제 (`ContentView.swift`, `프로젝트명App.swift`)
5. 이 폴더의 모든 `.swift` 파일을 프로젝트에 드래그 앤 드롭
6. `AquariumApp.swift`가 `@main` 진입점
7. **Build & Run!**

## 파일 구조

```
AquariumApp/
├── AquariumApp.swift          # 앱 진입점
├── ContentView.swift          # 메인 화면 (수족관 + 컨트롤)
├── Models/
│   ├── Creature.swift         # 캐릭터 데이터 모델
│   ├── Bubble.swift           # 거품 모델
│   └── TimeOfDay.swift        # 시간대 테마
├── ViewModels/
│   └── AquariumViewModel.swift # 애니메이션 & 상태 관리
└── Views/
    ├── AquariumView.swift     # 수족관 메인 뷰
    ├── OceanBackgroundView.swift # 시간대별 배경
    ├── CreatureView.swift     # 개별 캐릭터 렌더링
    ├── BubbleView.swift       # 거품 렌더링
    └── CreatureEditorView.swift # 캐릭터 추가/편집
```

## 요구 사항

- Xcode 15+
- iOS 16.0+
- Swift 5.9+
