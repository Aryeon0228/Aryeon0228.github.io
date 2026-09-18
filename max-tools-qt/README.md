# STUDIO PENUMBRA · Max Tools / Qt edition 0.1

3ds Max **2026용 시험판** · Python + PySide6

## 실행

1. ZIP을 **전부 압축 해제**합니다.
2. `penumbra_qt` 폴더, `_bootstrap.py`, 실행 파일의 위치를 그대로 유지합니다.
3. Max의 **Scripting → Run Script**에서 `PenumbraTools.ms`를 실행합니다.
4. 도구 목록에서 원하는 도구를 누릅니다. 개별 ZIP은 해당 도구의 `.ms`를 실행합니다.

도구별 `.ms`는 Python 창을 여는 실행 파일입니다. UI와 기능은 `penumbra_qt` 안의
`.py`에서 읽고 수정할 수 있습니다. 별도 Python/PySide 설치가 필요 없습니다.
시스템 Python에서 더블클릭해서 실행하지 마세요. 창을 열어도 기존 Undo 기록을 지우지 않습니다.

## 도구

| 도구 | 개별 실행 파일 | 기능 |
|---|---|---|
| Snap UV Vertices | SnapUVQt.ms | 가까운 UV 정점을 평균 U/V 위치로 정렬. W 유지, Weld 없음. |
| UV Exporter | UVExporterQt.ms | 임시 복사본에서 UV를 1K/2K/4K PNG로 출력. |
| Outline Normal Baker | OutlineNormalQt.ms | 정적 복사본의 Map 8에 외곽선용 노멀 저장. |
| Collinear Cleanup | CollinearQt.ms | 직선 위 정점을 선택/제거. 월드 거리로 판정. |
| Quick Export FBX | QuickExportFBXQt.ms | 복사본에 XForm·피벗·원점 설정 후 Y-Up FBX 출력. |
| Batch FBX Importer | BatchFBXImporterQt.ms | 현재 장면에 추가 또는 파일별 새 장면으로 가져오기. |

### Snap UV

Unwrap UVW가 있는 오브젝트 하나를 선택하고 Edit UVWs에서 정점을 선택합니다.
여러 Unwrap이 있으면 작업할 모디파이어를 스택에서 선택합니다. 미리보기 후 정렬하세요.
UV 거리로 연결된 정점들을 한 그룹으로 묶습니다. A–B, B–C가 가까우면 A–C가 멀어도 같은 그룹입니다.

### 노멀 베이크

현재 프레임의 정적 `_OutlineNormals` 복사본이 생성됩니다. 원본은 유지합니다.
기존 규약인 **Max map channel 8 / (normal + 1) / 2**를 유지하며 복사본의 다른 UV는 보존합니다.
게임 엔진에 FBX로 가져온 뒤 MK Toon의 UV 채널과 축을 확인하세요.

### 정점 정리

모디파이어가 없는 Editable Poly가 대상입니다. 공유 데이터의 인스턴스가 있다면
모든 인스턴스를 함께 선택해야 하며, 위쪽 모디파이어가 있으면 제외합니다.
미리보기는 오브젝트 하나에서 제거 후보를 선택합니다. 실제 제거는 현재 상태로 다시 계산합니다.

### FBX

내보내기는 기존 파일을 덮어쓰지 않습니다. 원본 오브젝트와 FBX 플러그인 설정을 보존합니다.
가져오기의 ‘파일마다 새 장면’은 장면 전환마다 Max의 저장 확인을 거치며 마지막 장면만 남습니다.
이 모드에서는 Quiet Mode를 끄세요. 가져오기가 실패하면 부분적으로 추가된 내용이 있을 수 있으며
화면의 상세 기록에서 중단 위치를 확인할 수 있습니다. 파일 쓰기·장면 초기화는 일반 편집 Undo와 다릅니다.

## 버전 구분

- **Qt · Python:** 현재 배포본의 대상은 Max 2026입니다. 실행 파일도 2026 이상에서 열립니다.
- **기존 MAXScript:** 홈페이지에서 `.ms` 또는 기존 스크립트 묶음으로 따로 받습니다.
  Max 2025 이하 사용자는 기존판을 선택하세요. 모든 과거 버전에 대한 실행을 보증하는 표기는 아닙니다.
- PySide6 자체는 Max 2025에도 포함되어 있습니다. 이 도구들의 2025 호환 실행은 아직 확인하지 않았습니다.

## 검증 범위

순수 계산, 가상 Max API를 통한 오류/복원 흐름, 독립 PySide6의 화면·입력·버튼 동작을 검사했습니다.
개발 환경이 macOS라 **실제 Windows/3ds Max 2026에서 모든 도구를 실행 검증한 상태는 아닙니다.**
따라서 Qt 묶음은 시험판으로 제공하며, 기존 MAXScript도 별도로 유지합니다.

Autodesk: https://help.autodesk.com/cloudhelp/2026/ENU/MAXDEV-Python/files/MAXDEV_Python_creating_python_uis_html.html
2025 PySide6: https://help.autodesk.com/cloudhelp/2025/ENU/MAXDEV-Python/files/MAXDEV_Python_about_the_3ds_max_python_api_html.html
