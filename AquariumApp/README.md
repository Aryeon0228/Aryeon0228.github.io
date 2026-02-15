# AquariumApp - 나만의 수족관

인터랙티브 수족관 iOS 앱 + 홈화면 위젯. 커스텀 이모지/사진 캐릭터가 헤엄치고, 시간대에 따라 배경이 변합니다.

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

### 홈화면 위젯
- **Small / Medium / Large** 3가지 크기 지원
- 시간대별 배경 자동 전환
- 15분마다 캐릭터 위치 랜덤 변경 (살아있는 느낌)
- 앱에서 추가한 캐릭터가 위젯에 그대로 표시
- 탭하면 앱으로 이동

### 커스텀 캐릭터
- **이모지**: 바다 생물 18종 + 재미 이모지 16종
- **사진**: 사진첩에서 선택해서 원형으로 수족관에 추가
- 캐릭터별 크기/속도 랜덤 설정
- 추가/삭제 자유
- 앱 ↔ 위젯 자동 동기화

## Xcode 세팅 방법

### 1단계: 앱 프로젝트 생성
1. **Xcode** → `File` → `New` → `Project`
2. **iOS** → **App** 선택
3. 설정:
   - Product Name: `AquariumApp`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Minimum Deployments: **iOS 16.0**
4. 프로젝트 생성 후, 기본 파일 삭제
5. `AquariumApp.swift`, `ContentView.swift`, `Models/`, `ViewModels/`, `Views/`, `Shared/` 폴더의 파일을 드래그 앤 드롭

### 2단계: Widget Extension 추가
1. `File` → `New` → `Target`
2. **Widget Extension** 선택
3. 설정:
   - Product Name: `AquariumWidgetExtension`
   - **Include Configuration App Intent** 체크 해제
4. 자동 생성된 파일 삭제
5. `Widget/` 폴더의 파일 3개를 위젯 타겟에 드래그 앤 드롭
6. `Shared/` 폴더의 파일 2개를 **앱 타겟 + 위젯 타겟 모두에** 추가 (Target Membership 체크)

### 3단계: App Group 설정
1. 프로젝트 → **앱 타겟** → `Signing & Capabilities` → `+ Capability` → **App Groups**
2. `group.com.aquariumapp` 추가
3. **위젯 타겟**에서도 동일하게 App Group 추가
4. `Shared/SharedCreature.swift`의 `appGroupID`가 동일한지 확인

### 4단계: Build & Run!

## 파일 구조

```
AquariumApp/
├── AquariumApp.swift              # 앱 진입점 (@main)
├── ContentView.swift              # 메인 화면 (수족관 + 컨트롤)
├── Models/
│   ├── Creature.swift             # 캐릭터 데이터 모델
│   ├── Bubble.swift               # 거품 모델
│   └── TimeOfDay.swift            # 시간대 테마
├── ViewModels/
│   └── AquariumViewModel.swift    # 애니메이션 & 상태 관리
├── Views/
│   ├── AquariumView.swift         # 수족관 메인 뷰
│   ├── OceanBackgroundView.swift  # 시간대별 배경
│   ├── CreatureView.swift         # 개별 캐릭터 렌더링
│   ├── BubbleView.swift           # 거품 렌더링
│   └── CreatureEditorView.swift   # 캐릭터 추가/편집
├── Shared/                        # 앱 + 위젯 공유
│   ├── SharedCreature.swift       # 공유 캐릭터 모델 + DataManager
│   └── SharedTimeOfDay.swift      # 공유 시간대 모델
└── Widget/                        # 위젯 Extension
    ├── AquariumWidgetBundle.swift  # 위젯 번들 진입점 (@main)
    ├── AquariumWidget.swift       # TimelineProvider + Widget 정의
    └── AquariumWidgetViews.swift  # 위젯 렌더링 뷰 (S/M/L)
```

## 요구 사항

- Xcode 15+
- iOS 16.0+
- Swift 5.9+
