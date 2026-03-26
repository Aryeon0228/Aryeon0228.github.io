try(destroyDialog rlSmoothNormalBaker)catch()

rollout rlSmoothNormalBaker "Outline Normal Baker v1.4" width:280
(
    group "Info"
    (
        label lbl1 "Bakes smoothed normals to UV7 channel" align:#left
        label lbl2 "for MK Toon outline fix." align:#left
    )
    
    group "Bake"
    (
        label lblSelected "Selected: 0 objects" align:#left
        button btnBake "BAKE" width:240 height:40
        progressBar pbProgress value:0 width:240 height:10
    )
    
    group "Log"
    (
        editText etLog "" height:100 readOnly:true
    )
    
    button btnHelp "How to Use" width:130 align:#left across:2
    button btnClose "Close" width:130 align:#right
    
    fn updateSelection =
    (
        local validCount = 0
        for obj in selection where superClassOf obj == GeometryClass do
            validCount += 1
        lblSelected.text = "Selected: " + validCount as string + " objects"
    )
    
    fn addLog msg =
    (
        if etLog.text == "" then
            etLog.text = msg
        else
            etLog.text = etLog.text + "\n" + msg
    )
    
    fn bakeSmoothedNormalToUV7 obj =
    (
        -- Convert to Editable Mesh for stable operation
        if classof obj != Editable_Mesh then
        (
            if obj.modifiers.count > 0 then
                maxOps.CollapseNodeTo obj 1 true
            convertToMesh obj
        )
        
        local numVerts = meshop.getNumVerts obj
        local numFaces = meshop.getNumFaces obj
        
        if numVerts == 0 or numFaces == 0 then
            throw "Empty mesh"
        
        -- Expand map channels to support channel 8
        local currentMaps = meshop.getNumMaps obj
        if currentMaps <= 8 then
            meshop.setNumMaps obj 9
        
        -- Helper: get triangle area from 3 points
        fn getTriArea p1 p2 p3 =
        (
            local e1 = p2 - p1
            local e2 = p3 - p1
            length (cross e1 e2) * 0.5
        )

        -- Helper: get angle at vertex in a triangle
        fn getVertAngle pivot p1 p2 =
        (
            local e1 = normalize (p1 - pivot)
            local e2 = normalize (p2 - pivot)
            local d = dot e1 e2
            d = amax (-1.0) (amin 1.0 d)
            acos d
        )

        -- Calculate smoothed normals per vertex (area + angle weighted)
        local smoothNormals = #()
        for v = 1 to numVerts do
        (
            local vertFaces = meshop.getFacesUsingVert obj v as array
            local avgNormal = [0,0,0]
            local vertPos = meshop.getVert obj v

            for f in vertFaces do
            (
                local faceVerts = getFace obj f
                local i1 = faceVerts.x as integer
                local i2 = faceVerts.y as integer
                local i3 = faceVerts.z as integer

                local p1 = meshop.getVert obj i1
                local p2 = meshop.getVert obj i2
                local p3 = meshop.getVert obj i3

                local area = getTriArea p1 p2 p3

                -- Find the angle at the current vertex
                local angle = 0.0
                if i1 == v then angle = getVertAngle p1 p2 p3
                else if i2 == v then angle = getVertAngle p2 p1 p3
                else if i3 == v then angle = getVertAngle p3 p1 p2

                local weight = area * angle
                local fn_ = getFaceNormal obj f
                avgNormal += fn_ * weight
            )

            if length avgNormal > 0 then
                avgNormal = normalize avgNormal
            else
                avgNormal = [0,0,1]

            smoothNormals[v] = (avgNormal + [1,1,1]) / 2.0
        )
        
        -- Build UV channel 8
        meshop.setMapSupport obj 8 true
        meshop.setNumMapVerts obj 8 numVerts
        meshop.setNumMapFaces obj 8 numFaces
        
        for v = 1 to numVerts do
        (
            local n = smoothNormals[v]
            meshop.setMapVert obj 8 v [n.x, n.y, n.z]
        )
        
        for f = 1 to numFaces do
        (
            local faceVerts = getFace obj f
            meshop.setMapFace obj 8 f faceVerts
        )
        
        -- Convert back to Editable Poly
        convertToPoly obj
        
        return true
    )
    
    on btnBake pressed do
    (
        local validObjs = for obj in selection where superClassOf obj == GeometryClass collect obj
        
        if validObjs.count == 0 then
        (
            messageBox "Please select objects!" title:"Notice"
            return()
        )
        
        etLog.text = ""
        pbProgress.value = 0
        
        local successCount = 0
        local totalCount = validObjs.count
        
        for i = 1 to totalCount do
        (
            local obj = validObjs[i]
            try
            (
                bakeSmoothedNormalToUV7 obj
                addLog ("Done: " + obj.name)
                successCount += 1
            )
            catch
            (
                local errMsg = getCurrentException()
                addLog ("Fail: " + obj.name)
                addLog ("  > " + errMsg)
            )
            pbProgress.value = (i as float / totalCount * 100)
        )
        
        addLog ("----------------")
        addLog ("Complete: " + successCount as string + "/" + totalCount as string)
        messageBox (successCount as string + " objects baked!") title:"Complete"
    )
    
    on btnHelp pressed do
    (
        messageBox "1. Select objects\n2. Click [BAKE]\n3. Export FBX (include UV channels)\n4. In Unity: Outline Data > Normal" title:"How to Use"
    )
    
    on btnClose pressed do
        destroyDialog rlSmoothNormalBaker
    
    on rlSmoothNormalBaker open do
    (
        updateSelection()
        callbacks.addScript #selectionSetChanged "rlSmoothNormalBaker.updateSelection()" id:#smoothNormalBakerCallback
    )
    
    on rlSmoothNormalBaker close do
        callbacks.removeScripts id:#smoothNormalBakerCallback
)

createDialog rlSmoothNormalBaker