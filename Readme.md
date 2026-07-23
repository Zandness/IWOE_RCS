## Intelligent Warehouse Optimization Engine (IWOE) with External RCS Integration ##

An intelligent, data-driven Warehouse Management System (WMS) module designed to bridge high-level order fulfillment planning with real-time physical fleet execution. IWOE evaluates historical order velocity through Cumulative ABC Analysis, dynamically reorganizes warehouse storage layouts, and streams high-frequency task payloads to external Robot Control Systems (RCS) via low-latency WebSockets.

💡 **System Overview**

Modern automated warehouses suffer from two major operational bottlenecks:

1. Suboptimal Placement (Dead Stock in Prime Zones): High-velocity items stored deep in aisles force Autonomous Mobile Robots (AMRs) to travel extra distances, while slow-moving items occupy prime locations near packing docks.

2. Siloed Systems: Analytics dashboards rarely communicate bi-directionally with external physical robot controllers in real time.

IWOE solves this by uniting data science, optimization algorithms, and IoT messaging:

- Analyzes sales transactions in MySQL using Cumulative ABC Analysis (Pareto Principle).

- Calculates optimal spatial grid coordinates to place fast movers near dispatch docks.

- Evaluates relocation viability via a physical Utility Score ($U_{\text{prop}}$).

- Dispatches task commands and audits microsecond network latency ($\Delta t_{\text{latency}}$) via a FastAPI WebSocket Bridge connected to an external RCS Monitor Client.
