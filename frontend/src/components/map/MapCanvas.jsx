import {
  useEffect,
  useRef,
  useState,
} from "react";


const SCALE = 30;

const AUTO_PAN_EDGE = 60;
const AUTO_PAN_SPEED = 12;

const DRAG_THRESHOLD = 6;

const FIT_PADDING = 70;

const MIN_BOUNDARY_SIZE = 1;

const MINI_WIDTH = 190;
const MINI_HEIGHT = 130;
const MINI_PADDING = 12;


/*
 * =====================================================
 * MAP CANVAS
 * =====================================================
 */

export default function MapCanvas({
  mapData,

  mode,
  tool,

  selectedNodeId,
  selectedEdgeId,

  boundarySelected,

  connectionStart,

  robots = [],

  selectedRobotId,
  onRobotClick,

  zoom,
  onZoomChange,

  fitRequest,

  onCanvasClick,

  onNodeClick,
  onNodeMove,

  onNodeDragStart,
  onNodeDragEnd,

  onEdgeClick,

  onBoundaryClick,
  onBoundaryDragStart,
  onBoundaryChange,
  onBoundaryDragEnd,
}) {
  /*
   * =====================================================
   * REFS
   * =====================================================
   */

  const viewportRef =
    useRef(null);


  const panRef =
    useRef({
      x: 220,
      y: 150,
    });


  /*
   * Background interaction
   *
   * type:
   *
   * PAN
   * NODE_PLACE
   */

  const backgroundDragRef =
    useRef(null);


  /*
   * Node Drag
   */

  const nodeDragRef =
    useRef(null);


  /*
   * Boundary Drag
   */

  const boundaryDragRef =
    useRef(null);


  /*
   * Node Auto Pan
   */

  const autoPanFrameRef =
    useRef(null);


  const dragPointerRef =
    useRef(null);


  /*
   * =====================================================
   * STATE
   * =====================================================
   */

  const [
    pan,
    setPan,
  ] = useState({
    x: 220,
    y: 150,
  });


  /*
   * =====================================================
   * PAN UPDATE
   * =====================================================
   */

  function updatePan(
    nextPan
  ) {
    panRef.current =
      nextPan;


    setPan(
      nextPan
    );
  }


  /*
   * =====================================================
   * FIT MAP
   * =====================================================
   */

  useEffect(() => {
    if (
      !fitRequest
    ) {
      return;
    }


    fitMapToViewport();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);


  function fitMapToViewport() {
    const viewport =
      viewportRef.current;


    if (!viewport) {
      return;
    }


    const rect =
      viewport.getBoundingClientRect();


    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return;
    }


    const bounds =
      calculateMapBounds(
        mapData
      );


    const worldWidth =
      Math.max(
        (
          bounds.maxX -
          bounds.minX
        ) *
          SCALE,

        SCALE
      );


    const worldHeight =
      Math.max(
        (
          bounds.maxY -
          bounds.minY
        ) *
          SCALE,

        SCALE
      );


    const availableWidth =
      Math.max(
        rect.width -
          FIT_PADDING * 2,

        100
      );


    const availableHeight =
      Math.max(
        rect.height -
          FIT_PADDING * 2,

        100
      );


    const nextZoom =
      clamp(
        Math.min(
          availableWidth /
            worldWidth,

          availableHeight /
            worldHeight
        ),

        0.25,
        4
      );


    const centerWorldX =
      (
        bounds.minX +
        bounds.maxX
      ) /
        2 *
      SCALE;


    const centerWorldY =
      (
        bounds.minY +
        bounds.maxY
      ) /
        2 *
      SCALE;


    const nextPan = {
      x:
        rect.width / 2 -
        centerWorldX *
          nextZoom,

      y:
        rect.height / 2 -
        centerWorldY *
          nextZoom,
    };


    updatePan(
      nextPan
    );


    onZoomChange(
      Number(
        nextZoom.toFixed(
          3
        )
      )
    );
  }


  /*
   * =====================================================
   * SCREEN -> WORLD
   * =====================================================
   */

  function screenToWorld(
    clientX,
    clientY
  ) {
    const viewport =
      viewportRef.current;


    if (!viewport) {
      return {
        x: 0,
        y: 0,
      };
    }


    const rect =
      viewport.getBoundingClientRect();


    return {
      x: Number(
        (
          (
            clientX -
            rect.left -
            panRef.current.x
          ) /
          zoom /
          SCALE
        ).toFixed(3)
      ),

      y: Number(
        (
          (
            clientY -
            rect.top -
            panRef.current.y
          ) /
          zoom /
          SCALE
        ).toFixed(3)
      ),
    };
  }


  /*
   * =====================================================
   * BACKGROUND POINTER DOWN
   *
   * FIX V12
   *
   * Select = Pan
   * Middle Mouse = Pan
   * Node Tool = Prepare Node Placement
   *
   * ก่อนหน้านี้ Node Tool ไม่ได้สร้าง session
   * ทำให้ PointerUp return ก่อนถึง onCanvasClick
   * =====================================================
   */

  function handleBackgroundPointerDown(
    event
  ) {
    /*
     * Left Mouse only for normal operations
     */

    const leftMouse =
      event.button === 0;


    const middleMouse =
      event.button === 1;


    /*
     * =========================================
     * NODE TOOL
     * =========================================
     */

    if (
      mode === "edit" &&
      tool === "node" &&
      leftMouse
    ) {
      event.preventDefault();


      backgroundDragRef.current = {
        type:
          "NODE_PLACE",

        pointerId:
          event.pointerId,

        startX:
          event.clientX,

        startY:
          event.clientY,

        moved:
          false,
      };


      try {
        event.currentTarget.setPointerCapture(
          event.pointerId
        );
      } catch {
        //
      }


      return;
    }


    /*
     * =========================================
     * PAN
     * =========================================
     */

    const allowLeftPan =
      leftMouse &&
      (
        tool === "select" ||
        mode === "monitor"
      );


    if (
      !middleMouse &&
      !allowLeftPan
    ) {
      return;
    }


    event.preventDefault();


    backgroundDragRef.current = {
      type:
        "PAN",

      pointerId:
        event.pointerId,

      startX:
        event.clientX,

      startY:
        event.clientY,

      originalPanX:
        panRef.current.x,

      originalPanY:
        panRef.current.y,

      moved:
        false,
    };


    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {
      //
    }
  }


  /*
   * =====================================================
   * BACKGROUND MOVE
   * =====================================================
   */

  function handleBackgroundPointerMove(
    event
  ) {
    const interaction =
      backgroundDragRef.current;


    if (!interaction) {
      return;
    }


    if (
      interaction.pointerId !==
      event.pointerId
    ) {
      return;
    }


    const dx =
      event.clientX -
      interaction.startX;


    const dy =
      event.clientY -
      interaction.startY;


    if (
      Math.abs(dx) >
        3 ||
      Math.abs(dy) >
        3
    ) {
      interaction.moved =
        true;
    }


    /*
     * NODE PLACE
     *
     * Mouse move ไม่ต้องทำอะไร
     */

    if (
      interaction.type ===
      "NODE_PLACE"
    ) {
      return;
    }


    /*
     * PAN
     */

    if (
      interaction.type ===
      "PAN"
    ) {
      updatePan({
        x:
          interaction.originalPanX +
          dx,

        y:
          interaction.originalPanY +
          dy,
      });
    }
  }


  /*
   * =====================================================
   * BACKGROUND POINTER UP
   * =====================================================
   */

  function handleBackgroundPointerUp(
    event
  ) {
    const interaction =
      backgroundDragRef.current;


    if (!interaction) {
      return;
    }


    if (
      interaction.pointerId !==
      event.pointerId
    ) {
      return;
    }


    backgroundDragRef.current =
      null;


    /*
     * =========================================
     * NODE PLACE
     * =========================================
     */

    if (
      interaction.type ===
      "NODE_PLACE"
    ) {
      /*
       * ถ้ากดแล้วลาก
       * ไม่สร้าง Node
       */

      if (
        interaction.moved
      ) {
        return;
      }


      const position =
        screenToWorld(
          event.clientX,
          event.clientY
        );


      onCanvasClick(
        position
      );


      return;
    }


    /*
     * =========================================
     * PAN
     * =========================================
     */

    if (
      interaction.type ===
      "PAN"
    ) {
      /*
       * ถ้ามีการลากจริง
       * = แค่ Pan
       */

      if (
        interaction.moved
      ) {
        return;
      }


      /*
       * Middle click
       * ไม่ clear selection
       */

      if (
        event.button !== 0
      ) {
        return;
      }


      /*
       * Click พื้นที่ว่าง
       */

      const position =
        screenToWorld(
          event.clientX,
          event.clientY
        );


      onCanvasClick(
        position
      );
    }
  }


  /*
   * =====================================================
   * BACKGROUND CANCEL
   * =====================================================
   */

  function handleBackgroundPointerCancel() {
    backgroundDragRef.current =
      null;


    stopAutoPan();
  }


  /*
   * =====================================================
   * ZOOM
   * =====================================================
   */

  function handleWheel(
    event
  ) {
    event.preventDefault();


    const viewport =
      viewportRef.current;


    if (!viewport) {
      return;
    }


    const rect =
      viewport.getBoundingClientRect();


    const mouseX =
      event.clientX -
      rect.left;


    const mouseY =
      event.clientY -
      rect.top;


    const oldZoom =
      zoom;


    const nextZoom =
      clamp(
        oldZoom *
          (
            event.deltaY < 0
              ? 1.1
              : 0.9
          ),

        0.25,
        4
      );


    /*
     * Keep pointer at same world location
     */

    const worldX =
      (
        mouseX -
        panRef.current.x
      ) /
      oldZoom;


    const worldY =
      (
        mouseY -
        panRef.current.y
      ) /
      oldZoom;


    updatePan({
      x:
        mouseX -
        worldX *
          nextZoom,

      y:
        mouseY -
        worldY *
          nextZoom,
    });


    onZoomChange(
      Number(
        nextZoom.toFixed(
          3
        )
      )
    );
  }


  /*
   * =====================================================
   * NODE POINTER DOWN
   * =====================================================
   */

  function handleNodePointerDown(
    event,
    node
  ) {
    /*
     * =========================================
     * MONITOR
     * =========================================
     */

    if (
      mode === "monitor"
    ) {
      return;
    }


    /*
     * =========================================
     * CONNECT TOOL
     *
     * FIX:
     * Click Node 1
     * Click Node 2
     * => Create Path
     * =========================================
     */

    if (
      tool === "connect"
    ) {
      event.stopPropagation();

      event.preventDefault();


      if (
        event.button !== 0
      ) {
        return;
      }


      onNodeClick(
        node.id
      );


      return;
    }


    /*
     * =========================================
     * NODE TOOL
     *
     * กด Node เดิมขณะ Add Node
     * ไม่สร้าง Node ซ้อน
     * =========================================
     */

    if (
      tool === "node"
    ) {
      event.stopPropagation();

      return;
    }


    /*
     * =========================================
     * SELECT TOOL
     * =========================================
     */

    if (
      tool !== "select"
    ) {
      return;
    }


    if (
      event.button !== 0
    ) {
      return;
    }


    event.stopPropagation();

    event.preventDefault();


    /*
     * Click = Select Node
     */

    onNodeClick(
      node.id
    );


    /*
     * Hold Session
     */

    nodeDragRef.current = {
      pointerId:
        event.pointerId,

      nodeId:
        node.id,

      startClientX:
        event.clientX,

      startClientY:
        event.clientY,

      dragging:
        false,

      pointerIsDown:
        true,
    };


    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {
      //
    }
  }


  /*
   * =====================================================
   * NODE POINTER MOVE
   * =====================================================
   */

  function handleNodePointerMove(
    event,
    node
  ) {
    const drag =
      nodeDragRef.current;


    if (!drag) {
      return;
    }


    event.stopPropagation();


    if (
      drag.pointerId !==
      event.pointerId
    ) {
      return;
    }


    if (
      !drag.pointerIsDown
    ) {
      return;
    }


    if (
      drag.nodeId !==
      node.id
    ) {
      return;
    }


    const dx =
      event.clientX -
      drag.startClientX;


    const dy =
      event.clientY -
      drag.startClientY;


    const distance =
      Math.hypot(
        dx,
        dy
      );


    /*
     * Click ยังไม่ถือว่า Drag
     */

    if (
      !drag.dragging &&
      distance <
        DRAG_THRESHOLD
    ) {
      return;
    }


    /*
     * Start Drag
     */

    if (
      !drag.dragging
    ) {
      drag.dragging =
        true;


      onNodeDragStart?.(
        node.id
      );
    }


    dragPointerRef.current = {
      clientX:
        event.clientX,

      clientY:
        event.clientY,
    };


    updateDraggedNodePosition();


    startAutoPan();
  }


  /*
   * =====================================================
   * UPDATE NODE POSITION
   * =====================================================
   */

  function updateDraggedNodePosition() {
    const drag =
      nodeDragRef.current;


    const pointer =
      dragPointerRef.current;


    if (
      !drag ||
      !drag.dragging ||
      !pointer
    ) {
      return;
    }


    const position =
      screenToWorld(
        pointer.clientX,
        pointer.clientY
      );


    const snapped =
      snapToGrid(
        position,
        mapData.gridSpacing
      );


    onNodeMove(
      drag.nodeId,
      snapped.x,
      snapped.y
    );
  }


  /*
   * =====================================================
   * NODE POINTER UP
   * =====================================================
   */

  function handleNodePointerUp(
    event,
    node
  ) {
    const drag =
      nodeDragRef.current;


    if (!drag) {
      return;
    }


    event.stopPropagation();


    if (
      drag.pointerId !==
      event.pointerId
    ) {
      return;
    }


    drag.pointerIsDown =
      false;


    if (
      drag.dragging
    ) {
      onNodeDragEnd?.(
        node.id
      );
    }


    stopAutoPan();


    nodeDragRef.current =
      null;


    dragPointerRef.current =
      null;


    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {
      //
    }
  }


  /*
   * =====================================================
   * NODE CANCEL
   * =====================================================
   */

  function handleNodePointerCancel(
    event,
    node
  ) {
    if (
      nodeDragRef.current
        ?.dragging
    ) {
      onNodeDragEnd?.(
        node.id
      );
    }


    stopAutoPan();


    nodeDragRef.current =
      null;


    dragPointerRef.current =
      null;
  }


  /*
   * =====================================================
   * AUTO PAN
   * =====================================================
   */

  function startAutoPan() {
    if (
      autoPanFrameRef.current
    ) {
      return;
    }


    function loop() {
      const drag =
        nodeDragRef.current;


      const pointer =
        dragPointerRef.current;


      if (
        !drag ||
        !drag.dragging ||
        !pointer
      ) {
        autoPanFrameRef.current =
          null;

        return;
      }


      const viewport =
        viewportRef.current;


      if (!viewport) {
        autoPanFrameRef.current =
          null;

        return;
      }


      const rect =
        viewport.getBoundingClientRect();


      let moveX = 0;
      let moveY = 0;


      if (
        pointer.clientX -
          rect.left <
        AUTO_PAN_EDGE
      ) {
        moveX =
          AUTO_PAN_SPEED;
      }


      if (
        rect.right -
          pointer.clientX <
        AUTO_PAN_EDGE
      ) {
        moveX =
          -AUTO_PAN_SPEED;
      }


      if (
        pointer.clientY -
          rect.top <
        AUTO_PAN_EDGE
      ) {
        moveY =
          AUTO_PAN_SPEED;
      }


      if (
        rect.bottom -
          pointer.clientY <
        AUTO_PAN_EDGE
      ) {
        moveY =
          -AUTO_PAN_SPEED;
      }


      if (
        moveX !== 0 ||
        moveY !== 0
      ) {
        updatePan({
          x:
            panRef.current.x +
            moveX,

          y:
            panRef.current.y +
            moveY,
        });


        updateDraggedNodePosition();
      }


      autoPanFrameRef.current =
        requestAnimationFrame(
          loop
        );
    }


    autoPanFrameRef.current =
      requestAnimationFrame(
        loop
      );
  }


  function stopAutoPan() {
    dragPointerRef.current =
      null;


    if (
      autoPanFrameRef.current
    ) {
      cancelAnimationFrame(
        autoPanFrameRef.current
      );


      autoPanFrameRef.current =
        null;
    }
  }


  /*
   * =====================================================
   * PATH CLICK
   * =====================================================
   */

  function handleEdgePointerDown(
    event,
    edge
  ) {
    /*
     * Path click ใช้เลือก Property เท่านั้น
     */

    if (
      mode !== "edit" ||
      tool !== "select"
    ) {
      return;
    }


    if (
      event.button !== 0
    ) {
      return;
    }


    event.stopPropagation();

    event.preventDefault();


    onEdgeClick(
      edge.id
    );
  }


  /*
   * =====================================================
   * BOUNDARY POINTER DOWN
   *
   * FIX สำคัญ
   *
   * Boundary ต้องไม่กิน event
   * ตอน Add Node / Add Path
   * =====================================================
   */

  function handleBoundaryPointerDown(
    event,
    action
  ) {
    /*
     * สำคัญ:
     *
     * return ก่อน stopPropagation
     *
     * Node Tool / Connect Tool
     * ต้องปล่อย event ผ่านไปที่ Map
     */

    if (
      mode !== "edit" ||
      tool !== "select" ||
      event.button !== 0
    ) {
      return;
    }


    event.stopPropagation();

    event.preventDefault();


    onBoundaryClick?.();


    const start =
      screenToWorld(
        event.clientX,
        event.clientY
      );


    boundaryDragRef.current = {
      pointerId:
        event.pointerId,

      action,

      startX:
        start.x,

      startY:
        start.y,

      originX:
        Number(
          mapData.originX
        ) || 0,

      originY:
        Number(
          mapData.originY
        ) || 0,

      width:
        Number(
          mapData.width
        ) || 1,

      height:
        Number(
          mapData.height
        ) || 1,

      started:
        false,
    };


    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {
      //
    }
  }


  /*
   * =====================================================
   * BOUNDARY MOVE / RESIZE
   * =====================================================
   */

  function handleBoundaryPointerMove(
    event
  ) {
    const drag =
      boundaryDragRef.current;


    if (!drag) {
      return;
    }


    if (
      drag.pointerId !==
      event.pointerId
    ) {
      return;
    }


    event.stopPropagation();


    const current =
      screenToWorld(
        event.clientX,
        event.clientY
      );


    const dx =
      current.x -
      drag.startX;


    const dy =
      current.y -
      drag.startY;


    const thresholdWorld =
      DRAG_THRESHOLD /
      SCALE /
      zoom;


    if (
      !drag.started &&
      Math.hypot(
        dx,
        dy
      ) <
        thresholdWorld
    ) {
      return;
    }


    if (
      !drag.started
    ) {
      drag.started =
        true;


      onBoundaryDragStart?.();
    }


    let originX =
      drag.originX;


    let originY =
      drag.originY;


    let width =
      drag.width;


    let height =
      drag.height;


    /*
     * =========================================
     * MOVE
     * =========================================
     */

    if (
      drag.action ===
      "MOVE"
    ) {
      originX =
        drag.originX +
        dx;


      originY =
        drag.originY +
        dy;
    }


    /*
     * =========================================
     * EAST
     *
     * FIX:
     * ห้ามใช้ action.includes("E")
     * เพราะคำว่า MOVE ก็มีตัว E
     * =========================================
     */

    if (
      [
        "E",
        "NE",
        "SE",
      ].includes(
        drag.action
      )
    ) {
      width =
        drag.width +
        dx;
    }


    /*
     * WEST
     */

    if (
      [
        "W",
        "NW",
        "SW",
      ].includes(
        drag.action
      )
    ) {
      originX =
        drag.originX +
        dx;


      width =
        drag.width -
        dx;
    }


    /*
     * SOUTH
     */

    if (
      [
        "S",
        "SE",
        "SW",
      ].includes(
        drag.action
      )
    ) {
      height =
        drag.height +
        dy;
    }


    /*
     * NORTH
     */

    if (
      [
        "N",
        "NE",
        "NW",
      ].includes(
        drag.action
      )
    ) {
      originY =
        drag.originY +
        dy;


      height =
        drag.height -
        dy;
    }


    /*
     * =========================================
     * MINIMUM WIDTH
     * =========================================
     */

    if (
      width <
      MIN_BOUNDARY_SIZE
    ) {
      if (
        [
          "W",
          "NW",
          "SW",
        ].includes(
          drag.action
        )
      ) {
        originX =
          drag.originX +
          drag.width -
          MIN_BOUNDARY_SIZE;
      }


      width =
        MIN_BOUNDARY_SIZE;
    }


    /*
     * =========================================
     * MINIMUM HEIGHT
     * =========================================
     */

    if (
      height <
      MIN_BOUNDARY_SIZE
    ) {
      if (
        [
          "N",
          "NE",
          "NW",
        ].includes(
          drag.action
        )
      ) {
        originY =
          drag.originY +
          drag.height -
          MIN_BOUNDARY_SIZE;
      }


      height =
        MIN_BOUNDARY_SIZE;
    }


    /*
     * =========================================
     * SNAP BOUNDARY
     * =========================================
     */

    if (
      mapData.snapBoundaryToGrid
    ) {
      const spacing =
        Math.max(
          Number(
            mapData.gridSpacing
          ) || 1,

          0.01
        );


      originX =
        snapNumber(
          originX,
          spacing
        );


      originY =
        snapNumber(
          originY,
          spacing
        );


      width =
        Math.max(
          MIN_BOUNDARY_SIZE,

          snapNumber(
            width,
            spacing
          )
        );


      height =
        Math.max(
          MIN_BOUNDARY_SIZE,

          snapNumber(
            height,
            spacing
          )
        );
    }


    onBoundaryChange?.({
      originX:
        Number(
          originX.toFixed(
            3
          )
        ),

      originY:
        Number(
          originY.toFixed(
            3
          )
        ),

      width:
        Number(
          width.toFixed(
            3
          )
        ),

      height:
        Number(
          height.toFixed(
            3
          )
        ),
    });
  }


  /*
   * =====================================================
   * BOUNDARY UP
   * =====================================================
   */

  function handleBoundaryPointerUp(
    event
  ) {
    const drag =
      boundaryDragRef.current;


    if (!drag) {
      return;
    }


    if (
      drag.pointerId !==
      event.pointerId
    ) {
      return;
    }


    event.stopPropagation();


    if (
      drag.started
    ) {
      onBoundaryDragEnd?.();
    }


    boundaryDragRef.current =
      null;


    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {
      //
    }
  }


  /*
   * =====================================================
   * BOUNDARY CANCEL
   * =====================================================
   */

  function handleBoundaryPointerCancel() {
    const drag =
      boundaryDragRef.current;


    if (
      drag?.started
    ) {
      onBoundaryDragEnd?.();
    }


    boundaryDragRef.current =
      null;
  }


  /*
   * =====================================================
   * ROBOT
   * =====================================================
   */

  function handleRobotPointerDown(
    event,
    robotId
  ) {
    if (
      mode !== "monitor"
    ) {
      return;
    }


    event.stopPropagation();


    onRobotClick(
      robotId
    );
  }


  const selectedRobot =
    robots.find(
      (robot) =>
        robot.id ===
        selectedRobotId
    ) || null;


  const selectedRobotPath =
    selectedRobot?.plannedPath ||
    [];


  /*
   * =====================================================
   * GRID
   * =====================================================
   */

  const gridSize =
    Math.max(
      Number(
        mapData.gridSpacing
      ) || 1,

      0.01
    ) *
    SCALE *
    zoom;


  /*
   * =====================================================
   * BOUNDARY COORDINATES
   * =====================================================
   */

  const boundaryX =
    (
      Number(
        mapData.originX
      ) || 0
    ) *
    SCALE;


  const boundaryY =
    (
      Number(
        mapData.originY
      ) || 0
    ) *
    SCALE;


  const boundaryWidth =
    Math.max(
      Number(
        mapData.width
      ) || 1,

      MIN_BOUNDARY_SIZE
    ) *
    SCALE;


  const boundaryHeight =
    Math.max(
      Number(
        mapData.height
      ) || 1,

      MIN_BOUNDARY_SIZE
    ) *
    SCALE;


  /*
   * =====================================================
   * MINI MAP
   * =====================================================
   */

  const miniBounds =
    calculateMapBounds(
      mapData,
      true
    );


  const miniTransform =
    calculateMiniTransform(
      miniBounds
    );


  function worldToMini(
    x,
    y
  ) {
    return {
      x:
        MINI_PADDING +
        (
          x -
          miniBounds.minX
        ) *
          miniTransform.scale,

      y:
        MINI_PADDING +
        (
          y -
          miniBounds.minY
        ) *
          miniTransform.scale,
    };
  }


  function handleMiniMapClick(
    event
  ) {
    event.stopPropagation();


    const rect =
      event.currentTarget.getBoundingClientRect();


    const localX =
      event.clientX -
      rect.left;


    /*
     * Mini Map มี Title ด้านบน
     *
     * SVG เริ่มหลัง title
     */

    const svg =
      event.currentTarget.querySelector(
        "svg"
      );


    if (!svg) {
      return;
    }


    const svgRect =
      svg.getBoundingClientRect();


    const svgX =
      event.clientX -
      svgRect.left;


    const svgY =
      event.clientY -
      svgRect.top;


    if (
      svgX < 0 ||
      svgY < 0 ||
      svgX >
        svgRect.width ||
      svgY >
        svgRect.height
    ) {
      return;
    }


    /*
     * CSS resize รองรับด้วย
     */

    const scaledMiniX =
      svgX *
      (
        MINI_WIDTH /
        svgRect.width
      );


    const scaledMiniY =
      svgY *
      (
        MINI_HEIGHT /
        svgRect.height
      );


    const worldX =
      miniBounds.minX +
      (
        scaledMiniX -
        MINI_PADDING
      ) /
        miniTransform.scale;


    const worldY =
      miniBounds.minY +
      (
        scaledMiniY -
        MINI_PADDING
      ) /
        miniTransform.scale;


    const viewport =
      viewportRef.current;


    if (!viewport) {
      return;
    }


    const viewportRect =
      viewport.getBoundingClientRect();


    updatePan({
      x:
        viewportRect.width /
          2 -
        worldX *
          SCALE *
          zoom,

      y:
        viewportRect.height /
          2 -
        worldY *
          SCALE *
          zoom,
    });
  }


  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <div
      ref={
        viewportRef
      }

      className={`map-canvas-wrapper tool-${tool}`}

      onPointerDown={
        handleBackgroundPointerDown
      }

      onPointerMove={
        handleBackgroundPointerMove
      }

      onPointerUp={
        handleBackgroundPointerUp
      }

      onPointerCancel={
        handleBackgroundPointerCancel
      }

      onWheel={
        handleWheel
      }
    >

      {/* =================================================
          INFINITE GRID
      ================================================= */}

      <div
        className="infinite-map-background"

        style={{
          "--grid-size":
            `${gridSize}px`,

          "--grid-x":
            `${positiveModulo(
              pan.x,
              gridSize
            )}px`,

          "--grid-y":
            `${positiveModulo(
              pan.y,
              gridSize
            )}px`,
        }}
      />


      {/* =================================================
          WORLD
      ================================================= */}

      <svg
        className="infinite-map-world"
      >

        <defs>

          <marker
            id="path-arrow"

            markerWidth="8"

            markerHeight="8"

            refX="7"

            refY="4"

            orient="auto"

            markerUnits="strokeWidth"
          >

            <path
              d="M 0 0 L 8 4 L 0 8 z"

              className="path-arrow-head"
            />

          </marker>

        </defs>


        <g
          transform={`
            translate(
              ${pan.x}
              ${pan.y}
            )

            scale(
              ${zoom}
            )
          `}
        >

          {/* =================================================
              WAREHOUSE BOUNDARY
          ================================================= */}

          {mapData.showBoundary && (
            <>

              {/*
               * VISUAL BOUNDARY
               *
               * pointerEvents none
               * เพื่อไม่บล็อก Node Tool / Path Tool
               */}

              <rect
                x={
                  boundaryX
                }

                y={
                  boundaryY
                }

                width={
                  boundaryWidth
                }

                height={
                  boundaryHeight
                }

                className={`warehouse-boundary ${
                  boundarySelected
                    ? "selected"
                    : ""
                }`}

                style={{
                  pointerEvents:
                    "none",
                }}
              />


              {/*
               * SELECT BOUNDARY BY STROKE
               *
               * มีเฉพาะ Select Tool
               */}

              {mode === "edit" &&
                tool ===
                  "select" && (

                <rect
                  x={
                    boundaryX
                  }

                  y={
                    boundaryY
                  }

                  width={
                    boundaryWidth
                  }

                  height={
                    boundaryHeight
                  }

                  fill="none"

                  stroke="transparent"

                  strokeWidth="14"

                  pointerEvents="stroke"

                  className="warehouse-boundary-hit"

                  onPointerDown={(event) =>
                    handleBoundaryPointerDown(
                      event,
                      "MOVE"
                    )
                  }

                  onPointerMove={
                    handleBoundaryPointerMove
                  }

                  onPointerUp={
                    handleBoundaryPointerUp
                  }

                  onPointerCancel={
                    handleBoundaryPointerCancel
                  }
                />

              )}


              {/*
               * SELECTED:
               *
               * Drag empty interior to move boundary
               *
               * Render ก่อน Path/Node
               * เพราะ Node และ Path จะยัง click ได้
               * เนื่องจาก render อยู่ด้านบน
               */}

              {boundarySelected &&
                mode === "edit" &&
                tool ===
                  "select" && (

                <rect
                  x={
                    boundaryX
                  }

                  y={
                    boundaryY
                  }

                  width={
                    boundaryWidth
                  }

                  height={
                    boundaryHeight
                  }

                  fill="transparent"

                  pointerEvents="all"

                  className="warehouse-boundary-move-area"

                  onPointerDown={(event) =>
                    handleBoundaryPointerDown(
                      event,
                      "MOVE"
                    )
                  }

                  onPointerMove={
                    handleBoundaryPointerMove
                  }

                  onPointerUp={
                    handleBoundaryPointerUp
                  }

                  onPointerCancel={
                    handleBoundaryPointerCancel
                  }
                />

              )}


              {boundarySelected &&
                mode === "edit" &&
                tool ===
                  "select" && (

                <BoundaryHandles
                  x={
                    boundaryX
                  }

                  y={
                    boundaryY
                  }

                  width={
                    boundaryWidth
                  }

                  height={
                    boundaryHeight
                  }

                  onPointerDown={
                    handleBoundaryPointerDown
                  }

                  onPointerMove={
                    handleBoundaryPointerMove
                  }

                  onPointerUp={
                    handleBoundaryPointerUp
                  }

                  onPointerCancel={
                    handleBoundaryPointerCancel
                  }
                />

              )}

            </>
          )}


          {/* =================================================
              PATHS
          ================================================= */}

          {mapData.edges.map(
            (edge) => {
              const from =
                mapData.nodes.find(
                  (node) =>
                    node.id ===
                    edge.from
                );


              const to =
                mapData.nodes.find(
                  (node) =>
                    node.id ===
                    edge.to
                );


              if (
                !from ||
                !to
              ) {
                return null;
              }


              const x1 =
                from.x *
                SCALE;


              const y1 =
                from.y *
                SCALE;


              const x2 =
                to.x *
                SCALE;


              const y2 =
                to.y *
                SCALE;


              const selected =
                mode === "edit" &&
                selectedEdgeId ===
                  edge.id;


              const highlighted =
                mode === "monitor" &&
                isEdgeInRobotPath(
                  edge,
                  selectedRobotPath
                );


              const pathType =
                edge.pathType ||
                "NORMAL";


              return (
                <g
                  key={
                    edge.id
                  }

                  className="map-edge-group"
                >

                  {/* PATH HITBOX */}

                  {mode === "edit" &&
                    tool ===
                      "select" && (

                    <line
                      x1={
                        x1
                      }

                      y1={
                        y1
                      }

                      x2={
                        x2
                      }

                      y2={
                        y2
                      }

                      className="map-edge-hitbox"

                      onPointerDown={(event) =>
                        handleEdgePointerDown(
                          event,
                          edge
                        )
                      }

                      onPointerUp={(event) =>
                        event.stopPropagation()
                      }
                    />

                  )}


                  {/* REAL PATH */}

                  <line
                    x1={
                      x1
                    }

                    y1={
                      y1
                    }

                    x2={
                      x2
                    }

                    y2={
                      y2
                    }

                    markerEnd={
                      !edge.bidirectional
                        ? "url(#path-arrow)"
                        : undefined
                    }

                    className={[
                      "map-edge",

                      `path-type-${pathType.toLowerCase()}`,

                      selected
                        ? "selected"
                        : "",

                      highlighted
                        ? "path-highlighted"
                        : "",

                      edge.enabled === false
                        ? "disabled"
                        : "",
                    ].join(" ")}
                  />


                  <text
                    x={
                      (
                        x1 +
                        x2
                      ) /
                      2
                    }

                    y={
                      (
                        y1 +
                        y2
                      ) /
                        2 -
                      9
                    }

                    textAnchor="middle"

                    className="edge-distance"
                  >
                    {edge.id}

                    {" • "}

                    {Number(
                      edge.distance
                    ).toFixed(
                      2
                    )}

                    {" m"}
                  </text>

                </g>
              );
            }
          )}


          {/* =================================================
              NODES
          ================================================= */}

          {mapData.nodes.map(
            (node) => (
              <NodeShape
                key={
                  node.id
                }

                node={
                  node
                }

                selected={
                  mode === "edit" &&
                  selectedNodeId ===
                    node.id
                }

                connecting={
                  mode === "edit" &&
                  connectionStart ===
                    node.id
                }

                onPointerDown={(event) =>
                  handleNodePointerDown(
                    event,
                    node
                  )
                }

                onPointerMove={(event) =>
                  handleNodePointerMove(
                    event,
                    node
                  )
                }

                onPointerUp={(event) =>
                  handleNodePointerUp(
                    event,
                    node
                  )
                }

                onPointerCancel={(event) =>
                  handleNodePointerCancel(
                    event,
                    node
                  )
                }
              />
            )
          )}


          {/* =================================================
              ROBOTS
          ================================================= */}

          {mode === "monitor" &&
            robots.map(
              (robot) => {
                const selected =
                  selectedRobotId ===
                  robot.id;


                return (
                  <g
                    key={
                      robot.id
                    }

                    className="monitor-robot"

                    transform={`
                      translate(
                        ${
                          robot.x *
                          SCALE
                        }

                        ${
                          robot.y *
                          SCALE
                        }
                      )
                    `}

                    onPointerDown={(event) =>
                      handleRobotPointerDown(
                        event,
                        robot.id
                      )
                    }
                  >

                    <circle
                      r={
                        selected
                          ? 16
                          : 13
                      }

                      className={[
                        "monitor-robot-body",

                        `status-${String(
                          robot.status
                        ).toLowerCase()}`,

                        selected
                          ? "selected"
                          : "",
                      ].join(" ")}
                    />


                    <text
                      x="0"

                      y="4"

                      textAnchor="middle"

                      className="monitor-robot-symbol"
                    >
                      R
                    </text>


                    <text
                      x="0"

                      y="-20"

                      textAnchor="middle"

                      className="monitor-robot-label"
                    >
                      {robot.id}
                    </text>

                  </g>
                );
              }
            )}

        </g>

      </svg>


      {/* =================================================
          ORIGIN
      ================================================= */}

      <div
        className="map-origin-marker"

        style={{
          left:
            pan.x,

          top:
            pan.y,
        }}
      >

        <span>
          0,0
        </span>

      </div>


      {/* =================================================
          MINI MAP
      ================================================= */}

      <MiniMap
        mapData={
          mapData
        }

        bounds={
          miniBounds
        }

        transform={
          miniTransform
        }

        worldToMini={
          worldToMini
        }

        pan={
          pan
        }

        zoom={
          zoom
        }

        viewportRef={
          viewportRef
        }

        onClick={
          handleMiniMapClick
        }
      />

    </div>
  );
}


/*
 * =====================================================
 * BOUNDARY HANDLES
 * =====================================================
 */

function BoundaryHandles({
  x,
  y,

  width,
  height,

  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) {
  const size =
    10;


  const handles = [
    {
      action:
        "NW",

      x,

      y,
    },

    {
      action:
        "N",

      x:
        x +
        width / 2,

      y,
    },

    {
      action:
        "NE",

      x:
        x +
        width,

      y,
    },

    {
      action:
        "E",

      x:
        x +
        width,

      y:
        y +
        height / 2,
    },

    {
      action:
        "SE",

      x:
        x +
        width,

      y:
        y +
        height,
    },

    {
      action:
        "S",

      x:
        x +
        width / 2,

      y:
        y +
        height,
    },

    {
      action:
        "SW",

      x,

      y:
        y +
        height,
    },

    {
      action:
        "W",

      x,

      y:
        y +
        height / 2,
    },
  ];


  return (
    <g
      className="boundary-handles"
    >
      {handles.map(
        (handle) => (
          <rect
            key={
              handle.action
            }

            x={
              handle.x -
              size / 2
            }

            y={
              handle.y -
              size / 2
            }

            width={
              size
            }

            height={
              size
            }

            rx="2"

            className={`boundary-resize-handle handle-${handle.action.toLowerCase()}`}

            onPointerDown={(event) =>
              onPointerDown(
                event,
                handle.action
              )
            }

            onPointerMove={
              onPointerMove
            }

            onPointerUp={
              onPointerUp
            }

            onPointerCancel={
              onPointerCancel
            }
          />
        )
      )}
    </g>
  );
}


/*
 * =====================================================
 * MINI MAP
 * =====================================================
 */

function MiniMap({
  mapData,

  transform,

  worldToMini,

  pan,
  zoom,

  viewportRef,

  onClick,
}) {
  const viewport =
    viewportRef.current;


  let viewportWorldX =
    0;


  let viewportWorldY =
    0;


  let viewportWorldWidth =
    0;


  let viewportWorldHeight =
    0;


  if (
    viewport
  ) {
    const rect =
      viewport.getBoundingClientRect();


    viewportWorldX =
      -pan.x /
      zoom /
      SCALE;


    viewportWorldY =
      -pan.y /
      zoom /
      SCALE;


    viewportWorldWidth =
      rect.width /
      zoom /
      SCALE;


    viewportWorldHeight =
      rect.height /
      zoom /
      SCALE;
  }


  const viewportMini =
    worldToMini(
      viewportWorldX,
      viewportWorldY
    );


  return (
    <div
      className="map-minimap"

      onPointerDown={(event) =>
        event.stopPropagation()
      }

      onPointerMove={(event) =>
        event.stopPropagation()
      }

      onPointerUp={(event) =>
        event.stopPropagation()
      }

      onClick={
        onClick
      }
    >

      <div className="map-minimap-title">
        MINI MAP
      </div>


      <svg
        width={
          MINI_WIDTH
        }

        height={
          MINI_HEIGHT
        }

        viewBox={`0 0 ${MINI_WIDTH} ${MINI_HEIGHT}`}
      >

        <rect
          x="0"

          y="0"

          width={
            MINI_WIDTH
          }

          height={
            MINI_HEIGHT
          }

          className="minimap-background"
        />


        {mapData.showBoundary && (
          <MiniBoundary
            mapData={
              mapData
            }

            worldToMini={
              worldToMini
            }

            scale={
              transform.scale
            }
          />
        )}


        {mapData.edges.map(
          (edge) => {
            const from =
              mapData.nodes.find(
                (node) =>
                  node.id ===
                  edge.from
              );


            const to =
              mapData.nodes.find(
                (node) =>
                  node.id ===
                  edge.to
              );


            if (
              !from ||
              !to
            ) {
              return null;
            }


            const pointA =
              worldToMini(
                from.x,
                from.y
              );


            const pointB =
              worldToMini(
                to.x,
                to.y
              );


            return (
              <line
                key={
                  edge.id
                }

                x1={
                  pointA.x
                }

                y1={
                  pointA.y
                }

                x2={
                  pointB.x
                }

                y2={
                  pointB.y
                }

                className="minimap-path"
              />
            );
          }
        )}


        {mapData.nodes.map(
          (node) => {
            const point =
              worldToMini(
                node.x,
                node.y
              );


            return (
              <circle
                key={
                  node.id
                }

                cx={
                  point.x
                }

                cy={
                  point.y
                }

                r="2.5"

                className="minimap-node"
              />
            );
          }
        )}


        <rect
          x={
            viewportMini.x
          }

          y={
            viewportMini.y
          }

          width={
            viewportWorldWidth *
            transform.scale
          }

          height={
            viewportWorldHeight *
            transform.scale
          }

          className="minimap-viewport"
        />

      </svg>

    </div>
  );
}


/*
 * =====================================================
 * MINI BOUNDARY
 * =====================================================
 */

function MiniBoundary({
  mapData,

  worldToMini,

  scale,
}) {
  const origin =
    worldToMini(
      Number(
        mapData.originX
      ) || 0,

      Number(
        mapData.originY
      ) || 0
    );


  return (
    <rect
      x={
        origin.x
      }

      y={
        origin.y
      }

      width={
        Number(
          mapData.width
        ) *
        scale
      }

      height={
        Number(
          mapData.height
        ) *
        scale
      }

      className="minimap-boundary"
    />
  );
}


/*
 * =====================================================
 * NODE SHAPE
 * =====================================================
 */

function NodeShape({
  node,

  selected,
  connecting,

  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) {
  const x =
    node.x *
    SCALE;


  const y =
    node.y *
    SCALE;


  const classes = [
    "map-node-shape",

    `node-type-${String(
      node.type ||
      "WAYPOINT"
    ).toLowerCase()}`,

    selected
      ? "selected"
      : "",

    connecting
      ? "connecting"
      : "",

    node.enabled === false
      ? "disabled"
      : "",
  ].join(" ");


  /*
   * ===================================================
   * STORAGE
   * ===================================================
   */

  if (
    node.type ===
    "STORAGE"
  ) {
    const width =
      Number(
        node.config?.width ||
        4
      ) *
      SCALE;


    const depth =
      Number(
        node.config?.depth ||
        2
      ) *
      SCALE;


    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )

          rotate(
            ${
              node.rotation ||
              0
            }
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >

        <rect
          x={
            -width / 2
          }

          y={
            -depth / 2
          }

          width={
            width
          }

          height={
            depth
          }

          rx="5"

          className={
            classes
          }
        />


        <LocalNodeLabel
          node={
            node
          }
        />

      </g>
    );
  }


  /*
   * ===================================================
   * CHARGING / DOCK
   * ===================================================
   */

  if (
    node.type ===
      "CHARGING" ||
    node.type ===
      "DOCK"
  ) {
    const width =
      Number(
        node.config?.width ||
        2
      ) *
      SCALE;


    const depth =
      Number(
        node.config?.depth ||
        2
      ) *
      SCALE;


    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )

          rotate(
            ${
              node.rotation ||
              0
            }
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >

        <rect
          x={
            -width / 2
          }

          y={
            -depth / 2
          }

          width={
            width
          }

          height={
            depth
          }

          rx="7"

          className={
            classes
          }
        />


        <text
          x="0"

          y="4"

          textAnchor="middle"

          className="node-type-symbol"
        >
          {node.type ===
          "CHARGING"
            ? "⚡"
            : "D"}
        </text>


        <LocalNodeLabel
          node={
            node
          }
        />

      </g>
    );
  }


  /*
   * ===================================================
   * ROAD
   * ===================================================
   */

  if (
    node.type ===
    "ROAD"
  ) {
    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )

          rotate(
            ${
              45 +
              (
                node.rotation ||
                0
              )
            }
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >

        <rect
          x="-10"

          y="-10"

          width="20"

          height="20"

          rx="3"

          className={
            classes
          }
        />

      </g>
    );
  }


  /*
   * ===================================================
   * PICKUP / DROPOFF
   * ===================================================
   */

  if (
    node.type ===
      "PICKUP" ||
    node.type ===
      "DROPOFF"
  ) {
    const points =
      node.type ===
      "PICKUP"
        ? "-12,10 0,-12 12,10"
        : "-12,-10 0,12 12,-10";


    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >

        <polygon
          points={
            points
          }

          className={
            classes
          }
        />


        <LocalNodeLabel
          node={
            node
          }
        />

      </g>
    );
  }


  /*
   * ===================================================
   * WAYPOINT / HOME / WAITING
   * ===================================================
   */

  return (
    <g
      className="map-node-group"

      onPointerDown={
        onPointerDown
      }

      onPointerMove={
        onPointerMove
      }

      onPointerUp={
        onPointerUp
      }

      onPointerCancel={
        onPointerCancel
      }
    >

      <circle
        cx={
          x
        }

        cy={
          y
        }

        r={
          selected ||
          connecting
            ? 10
            : 8
        }

        className={
          classes
        }
      />


      {node.type ===
        "HOME" && (

        <text
          x={
            x
          }

          y={
            y + 3
          }

          textAnchor="middle"

          className="node-type-symbol"
        >
          H
        </text>

      )}


      <text
        x={
          x
        }

        y={
          y - 15
        }

        textAnchor="middle"

        className="map-node-label"
      >
        {node.id}
      </text>

    </g>
  );
}


/*
 * =====================================================
 * NODE LABEL
 * =====================================================
 */

function LocalNodeLabel({
  node,
}) {
  return (
    <text
      x="0"

      y="-18"

      textAnchor="middle"

      className="map-node-label"
    >
      {node.id}
    </text>
  );
}


/*
 * =====================================================
 * MAP BOUNDS
 * =====================================================
 */

function calculateMapBounds(
  mapData,
  addPadding = false
) {
  const originX =
    Number(
      mapData.originX
    ) || 0;


  const originY =
    Number(
      mapData.originY
    ) || 0;


  const width =
    Math.max(
      Number(
        mapData.width
      ) || 1,

      1
    );


  const height =
    Math.max(
      Number(
        mapData.height
      ) || 1,

      1
    );


  let minX =
    originX;


  let minY =
    originY;


  let maxX =
    originX +
    width;


  let maxY =
    originY +
    height;


  for (
    const node
    of mapData.nodes
  ) {
    const nodeX =
      Number(
        node.x
      ) || 0;


    const nodeY =
      Number(
        node.y
      ) || 0;


    let halfWidth =
      0.5;


    let halfDepth =
      0.5;


    if (
      [
        "STORAGE",
        "CHARGING",
        "DOCK",
      ].includes(
        node.type
      )
    ) {
      halfWidth =
        (
          Number(
            node.config?.width
          ) || 1
        ) /
        2;


      halfDepth =
        (
          Number(
            node.config?.depth
          ) || 1
        ) /
        2;
    }


    /*
     * Rotation bounds
     */

    const angle =
      (
        Number(
          node.rotation
        ) || 0
      ) *
      Math.PI /
      180;


    const cos =
      Math.abs(
        Math.cos(
          angle
        )
      );


    const sin =
      Math.abs(
        Math.sin(
          angle
        )
      );


    const rotatedHalfWidth =
      halfWidth *
        cos +
      halfDepth *
        sin;


    const rotatedHalfDepth =
      halfWidth *
        sin +
      halfDepth *
        cos;


    minX =
      Math.min(
        minX,
        nodeX -
          rotatedHalfWidth
      );


    maxX =
      Math.max(
        maxX,
        nodeX +
          rotatedHalfWidth
      );


    minY =
      Math.min(
        minY,
        nodeY -
          rotatedHalfDepth
      );


    maxY =
      Math.max(
        maxY,
        nodeY +
          rotatedHalfDepth
      );
  }


  if (
    addPadding
  ) {
    const horizontal =
      maxX -
      minX;


    const vertical =
      maxY -
      minY;


    const padding =
      Math.max(
        horizontal *
          0.1,

        vertical *
          0.1,

        2
      );


    minX -=
      padding;


    maxX +=
      padding;


    minY -=
      padding;


    maxY +=
      padding;
  }


  return {
    minX,
    minY,
    maxX,
    maxY,
  };
}


/*
 * =====================================================
 * MINI TRANSFORM
 * =====================================================
 */

function calculateMiniTransform(
  bounds
) {
  const width =
    Math.max(
      bounds.maxX -
        bounds.minX,

      1
    );


  const height =
    Math.max(
      bounds.maxY -
        bounds.minY,

      1
    );


  return {
    scale:
      Math.min(
        (
          MINI_WIDTH -
          MINI_PADDING * 2
        ) /
          width,

        (
          MINI_HEIGHT -
          MINI_PADDING * 2
        ) /
          height
      ),
  };
}


/*
 * =====================================================
 * SNAP GRID
 * =====================================================
 */

function snapToGrid(
  position,
  spacing
) {
  const step =
    Number(
      spacing
    );


  if (
    !Number.isFinite(
      step
    ) ||
    step <= 0
  ) {
    return position;
  }


  return {
    x:
      snapNumber(
        position.x,
        step
      ),

    y:
      snapNumber(
        position.y,
        step
      ),
  };
}


/*
 * =====================================================
 * SNAP NUMBER
 * =====================================================
 */

function snapNumber(
  value,
  step
) {
  return Number(
    (
      Math.round(
        Number(
          value
        ) /
          step
      ) *
      step
    ).toFixed(
      3
    )
  );
}


/*
 * =====================================================
 * CLAMP
 * =====================================================
 */

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    Math.max(
      Number(
        value
      ),
      min
    ),

    max
  );
}


/*
 * =====================================================
 * MODULO
 * =====================================================
 */

function positiveModulo(
  value,
  divisor
) {
  if (
    !Number.isFinite(
      divisor
    ) ||
    divisor <= 0
  ) {
    return 0;
  }


  return (
    (
      value %
      divisor
    ) +
    divisor
  ) %
  divisor;
}


/*
 * =====================================================
 * ROBOT PATH CHECK
 * =====================================================
 */

function isEdgeInRobotPath(
  edge,
  path
) {
  if (
    !path ||
    path.length <
      2
  ) {
    return false;
  }


  for (
    let index =
      0;

    index <
    path.length -
      1;

    index++
  ) {
    const from =
      path[
        index
      ];


    const to =
      path[
        index + 1
      ];


    if (
      (
        edge.from ===
          from &&
        edge.to ===
          to
      ) ||
      (
        edge.from ===
          to &&
        edge.to ===
          from
      )
    ) {
      return true;
    }
  }


  return false;
}