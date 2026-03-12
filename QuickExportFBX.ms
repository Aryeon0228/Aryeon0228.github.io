/*
	Quick Export FBX
	선택한 오브젝트에 Reset XForm, 피벗 센터 정렬, 원점 이동 후
	Y-Up FBX로 지정 폴더에 익스포트하는 원클릭 스크립트
*/

try(destroyDialog QuickExportFBX) catch()

rollout QuickExportFBX "Quick Export FBX" width:400 height:195
(
	-- UI
	label lblFolder "익스포트 폴더:" pos:[10,10]
	edittext edtFolder "" pos:[10,28] width:310 readOnly:true
	button btnBrowse "..." pos:[325,28] width:65 height:20

	checkbox chkResetXForm "Reset XForm" pos:[10,60] checked:true
	checkbox chkCenterPivot "피벗을 오브젝트 중심으로" pos:[10,80] checked:true
	checkbox chkMoveOrigin "오브젝트를 원점(0,0,0)으로 이동" pos:[10,100] checked:true
	checkbox chkIndividual "오브젝트별 개별 파일로 익스포트" pos:[10,120] checked:true

	button btnExport "Export" pos:[10,150] width:380 height:35

	-- 저장된 경로
	local exportPath = ""

	-- 폴더 선택
	on btnBrowse pressed do
	(
		local dir = getSavePath caption:"익스포트 폴더 선택"
		if dir != undefined do
		(
			exportPath = dir + "\\"
			edtFolder.text = exportPath
		)
	)

	-- 메인 처리 함수
	fn processAndExport obj =
	(
		-- Reset XForm
		if chkResetXForm.checked do
		(
			resetXForm obj
			collapseStack obj
		)

		-- 피벗을 오브젝트 중심으로
		if chkCenterPivot.checked do
		(
			obj.pivot = obj.center
		)

		-- 원점으로 이동
		if chkMoveOrigin.checked do
		(
			obj.pos = [0, 0, 0]
		)
	)

	fn setupFBXExportSettings =
	(
		-- Y-Up 설정 (3ds Max는 Z-Up이므로 변환)
		FBXExporterSetParam "UpAxis" "Y"
		-- 기본 설정
		FBXExporterSetParam "SmoothingGroups" true
		FBXExporterSetParam "TangentSpaceExport" true
		FBXExporterSetParam "Preserveinstances" false
		FBXExporterSetParam "ASCII" false
		FBXExporterSetParam "FileVersion" "FBX202000"
	)

	-- 익스포트 실행
	on btnExport pressed do
	(
		if exportPath == "" then
		(
			messageBox "익스포트 폴더를 먼저 선택하세요." title:"알림"
			return undefined
		)

		if selection.count == 0 then
		(
			messageBox "익스포트할 오브젝트를 선택하세요." title:"알림"
			return undefined
		)

		local objs = selection as array
		local successCount = 0

		-- FBX 익스포트 설정
		setupFBXExportSettings()

		if chkIndividual.checked then
		(
			-- 개별 파일로 익스포트
			for obj in objs do
			(
				try
				(
					processAndExport obj

					select obj
					local filePath = exportPath + obj.name + ".fbx"
					exportFile filePath #noPrompt selectedOnly:true using:FBXEXP

					successCount += 1
				)
				catch
				(
					format "*** 실패: % - %\n" obj.name (getCurrentException())
				)
			)
		)
		else
		(
			-- 전체를 하나의 파일로 익스포트
			try
			(
				for obj in objs do processAndExport obj

				select objs
				local filePath = exportPath + "export.fbx"
				exportFile filePath #noPrompt selectedOnly:true using:FBXEXP

				successCount = objs.count
			)
			catch
			(
				format "*** 익스포트 실패: %\n" (getCurrentException())
			)
		)

		-- 결과
		select objs
		messageBox (successCount as string + "개 오브젝트 익스포트 완료") title:"완료"
	)
)

createDialog QuickExportFBX
