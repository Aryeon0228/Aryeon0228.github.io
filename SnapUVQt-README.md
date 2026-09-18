# Snap UV Vertices · Qt edition 0.1

STUDIO PENUMBRA / 3ds Max 2026용 Python + PySide6 도구

## 실행

1. ZIP을 다운로드하고 **압축을 전부 해제**합니다.
2. `SnapUVQt.ms`와 `SnapUVQt.py`를 같은 폴더에 둡니다.
3. Max에서 **Scripting → Run Script → SnapUVQt.ms**를 실행합니다.

Max 2026에 포함된 Python과 PySide6를 사용하므로 별도 설치가 필요 없습니다.
`.ms`는 Python 창을 여는 작은 실행 파일입니다. UI, 거리 계산, Max 연결 코드는
모두 `SnapUVQt.py`에서 읽고 수정할 수 있습니다. 일반 Python으로 더블클릭 실행하지 마세요.
실행 파일은 Max의 기존 Undo 기록을 지우지 않도록 설정되어 있습니다.

## 사용

- Unwrap UVW가 있는 **오브젝트 하나**를 선택합니다.
- Unwrap이 여러 개라면 스택에서 작업할 모디파이어를 선택합니다.
- Edit UVWs에서 정점 두 개 이상을 선택합니다. 선택 수와 실행 불가 이유가 창에 표시됩니다.
- 근접 거리(기본 0.005 UV)를 설정하고 **미리보기**를 누릅니다.
- **평균 위치로 정렬**을 누르면 현재 선택을 다시 읽고 적용합니다.
- `선택한 정점만 정렬`을 끄면 해당 오브젝트의 전체 UV 정점을 대상으로 합니다.
- 오류의 전체 내용은 **상태 / 오류 보기**에서 읽거나 복사할 수 있습니다.

U/V 거리가 설정값보다 작은 정점들을 연결 그룹으로 묶습니다.
A–B, B–C가 가깝다면 A–C가 멀어도 같은 그룹이 됩니다.
각 그룹의 평균 U/V 위치로 옮기며 개별 W 값은 유지합니다. Weld는 하지 않습니다.
변경한 정점들은 Max의 Undo 한 번으로 되돌릴 수 있습니다.

미리보기는 계산한 시점의 결과입니다. 실행할 때는 현재 선택과 좌표로 다시 계산합니다.
계산 중 상태가 바뀌면 적용을 중단합니다. 계산 단계의 취소는 UV를 변경하지 않습니다.

## 이 버전의 검증 범위

Python 거리 계산 테스트, 가상 Max 런타임을 통한 적용/오류/Undo 흐름 테스트,
독립 Qt 환경에서 화면·크기 변경·버튼 상태를 확인했습니다.
개발 환경은 macOS이므로 **실제 3ds Max 2026 안에서의 실행은 아직 확인하지 못한 시험 버전**입니다.
기존 MAXScript 버전도 홈페이지에서 계속 받을 수 있습니다.

## 참고

- Autodesk: https://help.autodesk.com/cloudhelp/2026/ENU/MAXDEV-Python/files/MAXDEV_Python_creating_python_uis_html.html
- pymxs: https://help.autodesk.com/cloudhelp/2026/ENU/MAXDEV-Python/files/MAXDEV_Python_using_pymxs_html.html
