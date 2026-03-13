/*
	Batch FBX Importer
	여러 FBX 파일을 한번에 임포트하는 맥스스크립트
*/

try(destroyDialog BatchFBXImporter) catch()

rollout BatchFBXImporter "Batch FBX Importer" width:400 height:320
(
	-- UI
	label lblInfo "임포트할 FBX 파일들을 추가하세요." pos:[10,10]
	listbox lbxFiles "" pos:[10,30] width:380 height:10

	button btnAdd "파일 추가" pos:[10,210] width:120 height:30
	button btnRemove "선택 제거" pos:[140,210] width:120 height:30
	button btnClear "전체 제거" pos:[270,210] width:120 height:30

	checkbox chkNewScene "파일마다 새 씬으로 임포트" pos:[10,250]
	checkbox chkMerge "현재 씬에 합치기" pos:[10,270] checked:true

	button btnImport "임포트 시작" pos:[10,295] width:380 height:30

	-- 파일 경로 저장용 배열
	local filePaths = #()

	-- 파일 추가
	on btnAdd pressed do
	(
		local dlg = dotNetObject "System.Windows.Forms.OpenFileDialog"
		dlg.title = "FBX 파일 선택"
		dlg.filter = "FBX Files (*.fbx)|*.fbx|All Files (*.*)|*.*"
		dlg.multiSelect = true

		local result = dlg.showDialog()
		if result == (dotNetClass "System.Windows.Forms.DialogResult").OK do
		(
			local files = dlg.fileNames
			for i = 1 to files.count do
			(
				local f = files[i]
				append filePaths f
				local items = lbxFiles.items
				append items (getFilenameFile f + ".fbx")
				lbxFiles.items = items
			)
		)
	)

	-- 선택 항목 제거
	on btnRemove pressed do
	(
		local sel = lbxFiles.selection
		if sel > 0 do
		(
			deleteItem filePaths sel
			local items = lbxFiles.items
			deleteItem items sel
			lbxFiles.items = items
		)
	)

	-- 전체 제거
	on btnClear pressed do
	(
		filePaths = #()
		lbxFiles.items = #()
	)

	-- 체크박스 상호 배타 처리
	on chkNewScene changed state do
	(
		if state do chkMerge.checked = false
	)

	on chkMerge changed state do
	(
		if state do chkNewScene.checked = false
	)

	-- 임포트 실행
	on btnImport pressed do
	(
		if filePaths.count == 0 then
		(
			messageBox "임포트할 파일이 없습니다." title:"알림"
		)
		else
		(
			local successCount = 0
			local failCount = 0

			for i = 1 to filePaths.count do
			(
				local f = filePaths[i]

				if doesFileExist f then
				(
					try
					(
						if chkNewScene.checked do resetMaxFile #noPrompt

						importFile f #noPrompt using:FBXIMP
						successCount += 1
					)
					catch
					(
						format "*** 임포트 실패: % - %\n" f (getCurrentException())
						failCount += 1
					)
				)
				else
				(
					format "*** 파일 없음: %\n" f
					failCount += 1
				)
			)

			messageBox (successCount as string + "개 성공, " + failCount as string + "개 실패") title:"임포트 완료"
		)
	)
)

createDialog BatchFBXImporter
