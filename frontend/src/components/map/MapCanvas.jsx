import {
  useRef,
  useState,
} from "react";

const SCALE = 30;

const AUTO_PAN_EDGE = 60;
const AUTO_PAN_SPEED = 12;


export default function MapCanvas({
  mapData,

  mode,
  tool,

  selectedNodeId,
  connectionStart,

  robots = [],

  selectedRobotId,
  onRobotClick,

  zoom,
  onZoomChange,

  onCanvasClick,

  onNodeClick,
  onNodeMove,

  onNodeDragStart,
  onNodeDragEnd,
}) {
  const viewportRef =
    useRef(null);


  const panRef =
    useRef({
      x: 220,
      y: 150,
    });


  const panDragRef =
    useRef(null);


  const autoPanFrameRef =
    useRef(null);


  const dragPointerRef =
    useRef(null);


  const movedRef =
    useRef(false);


  const [
    pan,
    setPan,
  ] = useState({
    x: 220,
    y: 150,
  });


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
   * =========================================
   * SCREEN -> WORLD
   * =========================================
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


    const screenX =
      clientX -
      rect.left;


    const screenY =
      clientY -
      rect.top;


    const worldPixelX =
      (
        screenX -
        panRef.current.x
      ) /
      zoom;


    const worldPixelY =
      (
        screenY -
        panRef.current.y
      ) /
      zoom;


    return {
      x: Number(
        (
          worldPixelX /
          SCALE
        ).toFixed(3)
      ),

      y: Number(
        (
          worldPixelY /
          SCALE
        ).toFixed(3)
      ),
    };
  }


  /*
   * =========================================
   * AUTO PAN
   * =========================================
   */

  function calculateAutoPan(
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


    const leftDistance =
      clientX -
      rect.left;


    const rightDistance =
      rect.right -
      clientX;


    const topDistance =
      clientY -
      rect.top;


    const bottomDistance =
      rect.bottom -
      clientY;


    let moveX = 0;
    let moveY = 0;


    if (
      leftDistance <
      AUTO_PAN_EDGE
    ) {
      moveX =
        AUTO_PAN_SPEED;
    }


    if (
      rightDistance <
      AUTO_PAN_EDGE
    ) {
      moveX =
        -AUTO_PAN_SPEED;
    }


    if (
      topDistance <
      AUTO_PAN_EDGE
    ) {
      moveY =
        AUTO_PAN_SPEED;
    }


    if (
      bottomDistance <
      AUTO_PAN_EDGE
    ) {
      moveY =
        -AUTO_PAN_SPEED;
    }


    return {
      x:
        moveX,

      y:
        moveY,
    };
  }


  function startAutoPan() {
    if (
      autoPanFrameRef.current
    ) {
      return;
    }


    function loop() {
      const pointer =
        dragPointerRef.current;


      if (!pointer) {
        autoPanFrameRef.current =
          null;

        return;
      }


      const movement =
        calculateAutoPan(
          pointer.clientX,
          pointer.clientY
        );


      if (
        movement.x !== 0 ||
        movement.y !== 0
      ) {
        updatePan({
          x:
            panRef.current.x +
            movement.x,

          y:
            panRef.current.y +
            movement.y,
        });


        pointer.updatePosition?.();
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
   * =========================================
   * BACKGROUND PAN
   * =========================================
   */

  function handleBackgroundPointerDown(
    event
  ) {
    const middleMouse =
      event.button === 1;


    const selectPan =
      event.button === 0 &&
      (
        tool === "select" ||
        mode === "monitor"
      );


    if (
      !middleMouse &&
      !selectPan
    ) {
      return;
    }


    event.preventDefault();


    movedRef.current =
      false;


    panDragRef.current = {
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
    };


    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {
      //
    }
  }


  function handleBackgroundPointerMove(
    event
  ) {
    const drag =
      panDragRef.current;


    if (!drag) {
      return;
    }


    if (
      drag.pointerId !==
      event.pointerId
    ) {
      return;
    }


    const dx =
      event.clientX -
      drag.startX;


    const dy =
      event.clientY -
      drag.startY;


    if (
      Math.abs(dx) > 3 ||
      Math.abs(dy) > 3
    ) {
      movedRef.current =
        true;
    }


    updatePan({
      x:
        drag.originalPanX +
        dx,

      y:
        drag.originalPanY +
        dy,
    });
  }


  function handleBackgroundPointerUp(
    event
  ) {
    const wasPanning =
      Boolean(
        panDragRef.current
      );


    panDragRef.current =
      null;


    if (
      wasPanning &&
      movedRef.current
    ) {
      movedRef.current =
        false;

      return;
    }


    if (
      event.button !== 0
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
  }


  /*
   * =========================================
   * ZOOM
   * =========================================
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


    const factor =
      event.deltaY < 0
        ? 1.1
        : 0.9;


    const nextZoom =
      clamp(
        oldZoom *
          factor,
        0.25,
        4
      );


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
   * =========================================
   * NODE DRAG / PATH CLICK
   * =========================================
   */

  function handleNodePointerDown(
    event,
    node
  ) {
    event.stopPropagation();


    if (
      mode === "monitor"
    ) {
      return;
    }


    if (
      tool === "connect"
    ) {
      onNodeClick(
        node.id
      );

      return;
    }


    if (
      tool !== "select"
    ) {
      return;
    }


    event.preventDefault();


    onNodeClick(
      node.id
    );


    onNodeDragStart?.(
      node.id
    );


    const pointerId =
      event.pointerId;


    let moved =
      false;


    function updateNodePosition() {
      const pointer =
        dragPointerRef.current;


      if (!pointer) {
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
        node.id,
        snapped.x,
        snapped.y
      );
    }


    function handleMove(
      moveEvent
    ) {
      if (
        moveEvent.pointerId !==
        pointerId
      ) {
        return;
      }


      moved =
        true;


      dragPointerRef.current = {
        clientX:
          moveEvent.clientX,

        clientY:
          moveEvent.clientY,

        updatePosition:
          updateNodePosition,
      };


      updateNodePosition();


      startAutoPan();
    }


    function handleUp(
      upEvent
    ) {
      if (
        upEvent.pointerId !==
        pointerId
      ) {
        return;
      }


      window.removeEventListener(
        "pointermove",
        handleMove
      );


      window.removeEventListener(
        "pointerup",
        handleUp
      );


      stopAutoPan();


      if (moved) {
        movedRef.current =
          true;
      }


      onNodeDragEnd?.(
        node.id
      );
    }


    window.addEventListener(
      "pointermove",
      handleMove
    );


    window.addEventListener(
      "pointerup",
      handleUp
    );
  }


  /*
   * =========================================
   * SELECTED ROBOT PATH
   * =========================================
   */

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
   * =========================================
   * GRID
   * =========================================
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
   * =========================================
   * RENDER
   * =========================================
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

      onPointerCancel={() => {
        panDragRef.current =
          null;

        stopAutoPan();
      }}

      onWheel={
        handleWheel
      }
    >

      {/* INFINITE GRID */}

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


      <svg
        className="infinite-map-world"
      >

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

          {/* WAREHOUSE BOUNDARY */}

          <rect
            x="0"
            y="0"

            width={
              mapData.width *
              SCALE
            }

            height={
              mapData.height *
              SCALE
            }

            className="warehouse-boundary"
          />


          {/* PATHS */}

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


              const highlighted =
                mode === "monitor" &&
                isEdgeInRobotPath(
                  edge,
                  selectedRobotPath
                );


              return (
                <g
                  key={
                    edge.id
                  }

                  className="map-edge-group"
                >

                  <line
                    x1={
                      from.x *
                      SCALE
                    }

                    y1={
                      from.y *
                      SCALE
                    }

                    x2={
                      to.x *
                      SCALE
                    }

                    y2={
                      to.y *
                      SCALE
                    }

                    className={
                      highlighted
                        ? "map-edge path-highlighted"
                        : "map-edge"
                    }
                  />


                  <text
                    x={
                      (
                        from.x +
                        to.x
                      ) /
                        2 *
                      SCALE
                    }

                    y={
                      (
                        (
                          from.y +
                          to.y
                        ) /
                        2 *
                        SCALE
                      ) -
                      9
                    }

                    textAnchor="middle"

                    className="edge-distance"
                  >
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


          {/* NODES */}

          {mapData.nodes.map(
            (node) => {

              const selected =
                mode === "edit" &&
                selectedNodeId ===
                  node.id;


              const connecting =
                mode === "edit" &&
                connectionStart ===
                  node.id;


              return (
                <NodeShape
                  key={
                    node.id
                  }

                  node={
                    node
                  }

                  selected={
                    selected
                  }

                  connecting={
                    connecting
                  }

                  onPointerDown={(
                    event
                  ) =>
                    handleNodePointerDown(
                      event,
                      node
                    )
                  }
                />
              );
            }
          )}


          {/* ROBOTS */}

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

                    onPointerDown={(
                      event
                    ) => {
                      event.stopPropagation();

                      onRobotClick(
                        robot.id
                      );
                    }}
                  >

                    <circle
                      r={
                        selected
                          ? 16
                          : 13
                      }

                      className={[
                        "monitor-robot-body",

                        `status-${robot.status.toLowerCase()}`,

                        selected
                          ? "selected"
                          : "",
                      ].join(
                        " "
                      )}
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
                      {
                        robot.id
                      }
                    </text>

                  </g>
                );
              }
            )}

        </g>

      </svg>


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

    </div>
  );
}


/*
 * =========================================
 * NODE SHAPE
 * =========================================
 */

function NodeShape({
  node,

  selected,
  connecting,

  onPointerDown,
}) {
  const x =
    node.x *
    SCALE;

  const y =
    node.y *
    SCALE;


  const classes = [
    "map-node-shape",

    `node-type-${node.type.toLowerCase()}`,

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
   * STORAGE
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
            ${node.rotation || 0}
          )
        `}

        onPointerDown={
          onPointerDown
        }
      >

        <rect
          x={
            -width /
            2
          }

          y={
            -depth /
            2
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

        <NodeLabel
          node={
            node
          }
        />

      </g>
    );
  }


  /*
   * CHARGING / DOCK
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
            ${node.rotation || 0}
          )
        `}

        onPointerDown={
          onPointerDown
        }
      >

        <rect
          x={
            -width /
            2
          }

          y={
            -depth /
            2
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


        <NodeLabel
          node={
            node
          }
        />

      </g>
    );
  }


  /*
   * ROAD DIAMOND
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
            ${45 + (node.rotation || 0)}
          )
        `}

        onPointerDown={
          onPointerDown
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

        <g
          transform="rotate(-45)"
        >
          <NodeLabel
            node={
              node
            }
          />
        </g>

      </g>
    );
  }


  /*
   * PICKUP
   */

  if (
    node.type ===
    "PICKUP"
  ) {
    return (
      <g
        className="map-node-group"

        onPointerDown={
          onPointerDown
        }
      >

        <polygon
          points={`
            ${x},${y - 12}
            ${x - 12},${y + 10}
            ${x + 12},${y + 10}
          `}

          className={
            classes
          }
        />

        <NodeLabel
          node={
            node
          }
        />

      </g>
    );
  }


  /*
   * DROPOFF
   */

  if (
    node.type ===
    "DROPOFF"
  ) {
    return (
      <g
        className="map-node-group"

        onPointerDown={
          onPointerDown
        }
      >

        <polygon
          points={`
            ${x},${y + 12}
            ${x - 12},${y - 10}
            ${x + 12},${y - 10}
          `}

          className={
            classes
          }
        />

        <NodeLabel
          node={
            node
          }
        />

      </g>
    );
  }


  /*
   * HOME / WAITING / WAYPOINT
   */

  return (
    <g
      className="map-node-group"

      onPointerDown={
        onPointerDown
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


      <NodeLabel
        node={
          node
        }
      />

    </g>
  );
}


function NodeLabel({
  node,
}) {
  return (
    <text
      x={
        node.type ===
          "STORAGE" ||
        node.type ===
          "CHARGING" ||
        node.type ===
          "DOCK" ||
        node.type ===
          "ROAD"
          ? 0
          : node.x *
            SCALE
      }

      y={
        node.type ===
          "STORAGE" ||
        node.type ===
          "CHARGING" ||
        node.type ===
          "DOCK" ||
        node.type ===
          "ROAD"
          ? -18
          : node.y *
              SCALE -
            15
      }

      textAnchor="middle"

      className="map-node-label"
    >
      {node.id}
    </text>
  );
}


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
    x: Number(
      (
        Math.round(
          position.x /
          step
        ) *
        step
      ).toFixed(
        3
      )
    ),

    y: Number(
      (
        Math.round(
          position.y /
          step
        ) *
        step
      ).toFixed(
        3
      )
    ),
  };
}


function clamp(
  value,
  min,
  max
) {
  return Math.min(
    Math.max(
      Number(value),
      min
    ),
    max
  );
}


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


function isEdgeInRobotPath(
  edge,
  path
) {
  if (
    !path ||
    path.length < 2
  ) {
    return false;
  }


  for (
    let index = 0;
    index <
    path.length - 1;
    index++
  ) {
    const from =
      path[index];


    const to =
      path[index + 1];


    if (
      (
        edge.from === from &&
        edge.to === to
      ) ||
      (
        edge.from === to &&
        edge.to === from
      )
    ) {
      return true;
    }
  }


  return false;
}