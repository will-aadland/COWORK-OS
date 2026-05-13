---
name: isa88-guide
description: >
  ISA-88 reference guide tuned to Promega's batch control implementation.
  Use when: ISA-88, ISA 88, S88, batch model, batch control, procedural model,
  physical model, PhaseManager, batch hierarchy, control model, batch state
  machine, Equipment Module, Control Module, Unit Procedure, Operation, Phase.
version: 0.5.0
---

# ISA-88 Batch Control Guide — Promega FERMB DS

Reference guide for ISA-88 batch control concepts and their implementation at Promega's Arnold Center. **Promega FERMB DS terminology is authoritative.** ISA-88 standard names are shown as secondary annotations only.

For the complete detailed reference including all tables, examples, and CM tag lists, read `references/ISA88_AI_Reference_FERMB_v3.docx`.

## What is ISA-88?

ISA-88 (ANSI/ISA-88 / IEC 61512, also called S88) is an international standard for batch process control. It defines models, terminology, and data structures for designing, operating, and documenting batch manufacturing systems. Part 1 (Models & Terminology) is the most commonly referenced part.

ISA-88 is widely adopted in pharmaceutical, biotech, food, and chemical manufacturing because it ensures consistency, traceability, and GMP compliance.

---

## Promega Terminology vs. ISA-88

**Critical:** Promega FERMB DS uses different names for some ISA-88 levels. Always use Promega names as the default when working with Promega documents.

| Promega Name (FERMB DS) | Abbreviation | ISA-88 Standard Name | Notes |
|---|---|---|---|
| **Recipe** | RCP | Procedure (PR) | Top-level batch recipe |
| **Unit Procedure** | UP | Unit Procedure (UP) | Same name, but Promega extends to multi-unit |
| **Operating Procedure** | OP | Operation (OP) | Same abbreviation, different full name |
| **Phase** | PH | Phase (PH) | Identical |
| **Equipment Module** | EM | Equipment Module (EM) | Promega uses "setpoints" instead of "Equipment Phases" |
| **Control Module** | CM | Control Module (CM) | Identical |

**Key Promega extension:** A Unit Procedure at FERMB may span more than one piece of equipment. ISA-88 standard specifies a strict 1:1 Unit-to-UP relationship. When reading FERMB DS documents, treat UP scope as multi-unit unless stated otherwise.

**Key terminology difference:** In FERMB DS, a "setpoint" issued to an EM is what ISA-88 calls an "Equipment Phase." A Phase issues setpoints to EMs; the EM commands its CMs to achieve that state.

---

## Physical Model (Equipment Hierarchy)

The Physical Model describes the physical assets in a hierarchical structure:

```
Enterprise (Promega Corporation)
  └─ Site (Arnold Center / ArC — formerly RDC)
      └─ Area (e.g., Fermentation B / FERMB)
          └─ Process Cell (e.g., P6 Fermentation System)
              └─ Unit (e.g., P6 Fermentor Vessel, Transfer Panels, CIP Skid interface)
                  └─ Equipment Module (e.g., Temperature Control EM, pH Control EM, DO Control EM, Agitator EM)
                      └─ Control Module (e.g., _2010_AIT_001, _2010_TIT_001, _2010_XV_001)
```

Most automation discussions focus on **Unit, EM, and CM** levels.

### Unit (U)
A Unit is the central concept in batch manufacturing — a collection of equipment that can carry out a major processing activity. A Unit can hold one batch at a time.

**Arnold Center Units include:** Ferm A vessels (P1, P2, P3, P4, P5), Ferm B vessel (P6), Large Scale mixing tanks, Transfer Panels (TP), centrifuges, CIP skids, and other systems.

**Note:** Transfer Panels (TPs) are treated as full Units in FERMB DS — they have their own UPs, OPs, and Phases for routing and CIP operations.

### Equipment Module (EM)
A functional sub-grouping within a Unit. Receives **setpoints** from Phases and commands its Control Modules.

Common EMs in bioprocessing:
- **Temperature Control EM** — heating/cooling jacket + temp sensor
- **pH Control EM** — pH probe + acid/base pumps
- **DO Control EM** — DO probe + O2 overlay + air sparger + agitator cascade
- **Agitator EM** — agitator VFD + speed feedback
- **Feed EM** — peristaltic pump + scale for feed delivery
- **CIP EM** — sequences cleaning solution flows

**EM fault handling:** When an EM faults, it sends a **Hold Phase Signal** back to the calling Phase. The Phase transitions: RUNNING → HOLDING → HELD. This can propagate up: Phase HELD → OP hold → UP hold.

### Control Module (CM)
The lowest-level controllable element — individual field devices.

**CM Tag Naming Convention (FERMB DS):** `_LLLL_TYPE_NNN`
- `LLLL` = 4-digit RIO location code (e.g., 2010 = P6 Fermentor area)
- `TYPE` = instrument type abbreviation:
  - `AIT` = Analyzer (pH)
  - `TIT` = Temperature transmitter
  - `SIC` = Speed indicator/controller
  - `XV` = On/Off valve
  - `FIC` = Flow indicator/controller
  - `PIT` = Pressure indicator/transmitter
- `NNN` = sequential 3-digit number

Example: `_2010_AIT_001` = location 2010, pH analyzer, first instrument

CMs do not know about recipes or batches. They only respond to direct commands from EMs or operators.

---

## Procedural Model (Recipe Hierarchy)

The Procedural Model defines how batches are executed. Promega FERMB DS uses a 4-level procedural hierarchy:

```
Recipe (RCP)  [ISA-88: Procedure / PR]
  └─ Unit Procedure (UP)
      └─ Operating Procedure (OP)  [ISA-88: Operation]
          └─ Phase (PH)
```

### Recipe (RCP) — ISA-88 equiv: Procedure / PR
The top-level procedural element. Defines the entire set of activities needed to complete one batch. Contains one or more Unit Procedures that may run sequentially or in parallel.

### Unit Procedure (UP)
A sequence of Operating Procedures. At Promega, a UP may span more than one piece of equipment (Promega extension of the standard).

### Operating Procedure (OP) — ISA-88 equiv: Operation
A logical grouping of Phases within a Unit Procedure. Represents a distinguishable process task or stage.

Common OP names in FERMB: **SIP** (Steam-In-Place), **Media Fill**, **Xin** (Transfer In), **Xout** (Transfer Out), **Batch Control**, **CIP** (Clean-In-Place).

### Phase (PH)
The smallest procedural element. Issues setpoints to one or more Equipment Modules. Phase logic runs in the PLC (PCS) and follows the ISA-88 Phase State Machine.

Examples: "Agitate at 200 RPM", "Control pH to 7.2", "Ramp Temp to 37°C", "Xin", "Xout"

---

## The 6-Layer Control Stack (Promega FERMB DS)

Promega integrates the Procedural Model and Physical Model into one top-to-bottom hierarchy:

| Layer | Promega Name | Model Type | Runs On | Role |
|---|---|---|---|---|
| 1 (Top) | Recipe (RCP) | Procedural | Process Cell | Top-level batch recipe; contains UPs |
| 2 | Unit Procedure (UP) | Procedural | Unit(s) | Batch operations for one or more units; contains OPs |
| 3 | Operating Procedure (OP) | Procedural | Unit | Named task grouping; contains Phases |
| 4 | Phase (PH) | Procedural | Unit / EM | Automation step in PLC; issues setpoints to EMs |
| 5 | Equipment Module (EM) | Physical | Unit | Receives setpoints from Phases; commands CMs; reports faults via Hold Phase Signal |
| 6 (Bottom) | Control Module (CM) | Physical | Unit / EM | Individual field device; receives commands from EMs |

**The key boundary:** Layers 1–4 are procedural (recipe-driven, run in PLC/PCS). Layers 5–6 are physical (equipment-driven). The handoff between Layer 4 (Phase) and Layer 5 (EM) is where recipe logic hands off to device control.

**Memory aid:** Recipe > UP > OP > Phase > EM > CM. Phases issue setpoints to EMs; EMs command CMs. Everything above Phase is organizational structure.

---

## Phase State Machine

ISA-88 defines a standard state machine that every Phase must implement.

### Phase States

| State | Type | Description |
|---|---|---|
| **IDLE** | Wait state | Phase is ready and waiting for a start command |
| **RUNNING** | Active state | Phase logic is executing normally |
| **PAUSING** | Transitional | Executing logic to reach a safe hold condition (PAUSE command) |
| **PAUSED** | Wait state | Reached a defined safe condition; waiting for RESUME |
| **HOLDING** | Transitional | Executing logic to reach a safe hold condition (HOLD command) |
| **HELD** | Wait state | In a controlled hold; awaiting RESTART command |
| **RESTARTING** | Transitional | Executing logic to resume from HELD state |
| **STOPPING** | Transitional | Executing a controlled stop sequence (STOP command) |
| **STOPPED** | Wait state | Completed a controlled stop; awaiting reset |
| **ABORTING** | Transitional | Executing emergency shutdown logic (ABORT command) |
| **ABORTED** | Wait state | Phase has aborted; awaiting reset |
| **COMPLETE** | End state | Successfully completed its task |
| **RESETTING** | Transitional | Executing logic to return to IDLE from STOPPED or ABORTED |

### Phase Commands

| Command | Abbrev | Effect | Valid From States |
|---|---|---|---|
| **START** | ST | Begin phase execution | IDLE |
| **PAUSE** | PA | Initiate a controlled pause | RUNNING |
| **RESUME** | RE | Resume from paused state | PAUSED |
| **HOLD** | HO | Move to held condition | RUNNING, PAUSED |
| **RESTART** | RS | Resume from held state | HELD |
| **STOP** | SP | Execute controlled shutdown | RUNNING, PAUSED, HELD |
| **ABORT** | AB | Execute emergency shutdown | Any active state |
| **RESET** | RT | Return to IDLE | STOPPED, ABORTED, COMPLETE |

### State Transitions

```
IDLE → (START) → RUNNING
RUNNING → (normal completion) → COMPLETE
RUNNING → (PAUSE) → PAUSING → PAUSED
PAUSED → (RESUME) → RUNNING
RUNNING / PAUSED → (HOLD) → HOLDING → HELD
HELD → (RESTART) → RESTARTING → RUNNING
RUNNING / PAUSED / HELD → (STOP) → STOPPING → STOPPED
Any active state → (ABORT) → ABORTING → ABORTED
STOPPED / ABORTED / COMPLETE → (RESET) → RESETTING → IDLE
```

**HOLD vs STOP vs ABORT:**
- **HOLD** = controlled pause that can be restarted (e.g., waiting for operator)
- **STOP** = controlled shutdown with no restart
- **ABORT** = emergency shutdown, typically triggered by safety interlock or alarm

**FERMB DS context:** When a Phase is RUNNING, it controls one or more EMs and issues setpoints. If the Phase is HELD or ABORTED, the EMs receive a corresponding Hold Phase Signal or abort command and must reach a safe state.

---

## Recipe Types

ISA-88 defines four recipe types at different levels of abstraction:

| Recipe Type | Level | Contains | Used By |
|---|---|---|---|
| **General Recipe** | Process / R&D | Process knowledge — what must happen scientifically | Process scientists, R&D |
| **Site Recipe** | Site | Site-specific formulations, constraints | Process engineers, tech transfer |
| **Master Recipe** | Equipment class | Equipment-class-specific instructions with setpoints | Manufacturing, automation engineers |
| **Control Recipe** | Specific run | A copy of the Master Recipe bound to specific equipment for one batch | Automation system (PCS), operators |

**Note:** The Control Recipe is what actually runs. It is generated from the Master Recipe before batch start, with actual unit assignments and parameter values. Batch records are derived from Control Recipe execution.

---

## Example: FERMB P6 Fermentor System

### Physical Model — P6

| ISA-88 Level | FERMB DS Asset / Tag | Notes |
|---|---|---|
| Site | Arnold Center (ArC) | Formerly RDC |
| Area | Fermentation B (FERMB) | Fermentation suite containing P6 |
| Process Cell | P6 Fermentation System | All equipment for P6 batch |
| Unit | P6 Fermentor Vessel | Primary vessel; holds the batch |
| Unit | Transfer Panels (TP) | Manifold panels for routing product/cleaning |
| Unit | CIP Skid interface | Cleaning supply and return |
| EM | Temperature Control EM | Heating/cooling jacket + temp sensor |
| EM | pH Control EM | pH probe + acid/base pumps |
| EM | DO Control EM | DO probe + O2 overlay + air sparger + agitator cascade |
| EM | Agitator EM | Agitator VFD + speed feedback |
| CM | `_2010_AIT_001` | pH probe (analog input) |
| CM | `_2010_TIT_001` | Temperature transmitter |
| CM | `_2010_SIC_001` | Agitator VFD (speed controller) |
| CM | `_2010_XV_001` | Outlet valve (discrete on/off) |

### Procedural Model — P6 Recipe Outline

| Level | Name / ID | Description |
|---|---|---|
| Recipe | P6-FERM-RCP-001 | Full batch recipe for P6 fermentation |
| UP | UP-1: Vessel Preparation | SIP, media fill; may span vessel and TP units |
| UP | UP-2: Inoculation | Transfer of seed culture into P6 |
| UP | UP-3: Fermentation | Main growth / production batch phase |
| UP | UP-4: Harvest / Transfer Out | Product transfer out via Xout OP |
| UP | UP-5: CIP | Clean-in-place for P6 vessel and lines |
| OP | SIP | Steam-in-place sterilization |
| OP | Media Fill | Add and condition fermentation media |
| OP | Xin (Transfer In) | Transfer inoculum or media into vessel |
| OP | Xout (Transfer Out) | Transfer product or waste out of vessel |
| OP | Batch Control | Active fermentation monitoring and control |
| Phase | PH: Agitate | Issues RPM setpoint to Agitator EM → VFD `_2010_SIC_001` |
| Phase | PH: Control pH | Issues pH setpoint to pH Control EM → acid/base pumps and `_2010_AIT_001` |
| Phase | PH: Control DO | Issues DO setpoint to DO Control EM → cascades to agitator and gas flow CMs |
| Phase | PH: Control Temp | Issues temp setpoint to Temperature Control EM → jacket and `_2010_TIT_001` |
| Phase | PH: Open Outlet Valve | Issues 'Open' setpoint to outlet valve EM → commands `_2010_XV_001` |

---

## Interpreting FERMB DS Documents

Each equipment section in a FERMB DS document follows a standard structure. Use this map to find information at the correct layer:

| DS Section | Content | Control Stack Layer |
|---|---|---|
| Description | Narrative overview of equipment purpose | Unit or EM description |
| Communication | I/O connections, network addresses, PLC/RIO mapping | CM-to-PLC wiring; defines LLLL location code |
| Control Modules | List of CMs with tags (`_LLLL_TYPE_NNN`), types, EU ranges | Layer 6 — CM |
| Equipment Modules | List of EMs with available setpoints and behavior | Layer 5 — EM |
| Phases | List of Phases; which EMs they call and which setpoints they issue | Layer 4 — Phase |
| Historian Tags | Subset of CM tags designated for data logging | CM outputs → batch record |
| Operating Procedures | List of OPs; each OP contains an ordered Phase sequence | Layer 3 — OP |
| Unit Procedures | List of UPs; each UP contains an ordered OP sequence | Layer 2 — UP |
| HMI Displays | Faceplate and overview screen descriptions | Operator interface (not a procedural layer) |

**DS interpretation rules:**
- "EM setpoint" = ISA-88 "Equipment Phase"
- CM alarms have HiHi / Hi / Lo / LoLo limits defined in the CM section
- EM fault → Hold Phase Signal → Phase HOLDING → HELD → OP hold → UP hold
- Phase ABORT → OP abort → UP abort → Recipe abort (unless caught lower)
- RIO cabinets provide physical I/O; each RIO serves a location code (LLLL) in CM tag names
- Transfer Panels (TP) are full Units with their own UPs, OPs, and Phases

---

## Interpreting Batch Documents

When analyzing a FERMB batch record, DS section, or procedure:
- Identify which layer of the control stack the document describes
- Parameters with setpoints and tolerances (e.g., pH 7.2 ± 0.1) are recipe Formula parameters issued to EMs via Phases
- Timestamps at start/end of named steps correspond to Phase or OP execution events in the PCS
- "Operator held batch" or "HOLD command issued" = Phase entered HELD state; EMs received Hold Phase Signal
- "Deviation from recipe" = actual value fell outside the specification in the Control Recipe
- Equipment referenced by tag number (e.g., `_2010_AIT_001`) = physical CM tags

**Document structure recognition:**
- Top-level title = Recipe (RCP) or Unit Procedure
- Numbered major sections (1.0, 2.0, 3.0...) = Operating Procedures
- Sub-steps (1.1, 1.2, 1.3...) = Phases or manual Phase steps
- Tables of setpoints/parameters = Formula section of the Recipe
- Pass/fail criteria at section ends = Phase or OP completion criteria

---

## Key Abbreviations (Promega FERMB DS)

| Abbrev | Promega Full Name | Definition |
|---|---|---|
| RCP | Recipe | Top-level batch recipe (ISA-88: Procedure / PR) |
| UP | Unit Procedure | Sequence of OPs on one or more units |
| OP | Operating Procedure | Named task grouping within a UP (ISA-88: Operation) |
| PH | Phase | Smallest procedural element; issues setpoints to EMs |
| EM | Equipment Module | Physical sub-system; receives setpoints; commands CMs |
| CM | Control Module | Individual field device; tagged `_LLLL_TYPE_NNN` |
| PC | Process Cell | All equipment needed to run the batch |
| PCS | Process Control System | Allen-Bradley PLC system executing Phase logic |
| RIO | Remote Input-Output | Cabinet connecting field devices to PLC; defines LLLL in tag names |
| TP | Transfer Panel | Manifold panel for routing; treated as a Unit in FERMB DS |
| ArC | Arnold Center | Promega facility (formerly RDC) |
| RDC | Research and Development Center | Former name for Arnold Center |
| Xin | Transfer In | OP or Phase for moving material into a vessel |
| Xout | Transfer Out | OP or Phase for moving material out of a vessel |
| FS | Functional Specification | Upstream design document; precedes the DS |
| DS | Design Specification | Detailed technical design document |
| EBR | Electronic Batch Record | Digital record of all batch events and parameters |
| BPR | Batch Production Record | Complete record of batch execution |
| CIP | Clean-In-Place | Automated cleaning procedure |
| SIP | Steam-In-Place | Automated sterilization procedure |
| DO | Dissolved Oxygen | Key bioprocess parameter |
| PID | Proportional-Integral-Derivative | Feedback control algorithm |
| EU | Engineering Units | Scaled real-world value from a sensor |
| vvm | Volume per Volume per Minute | Aeration rate unit |

---

## PhaseManager: ISA-88 in Rockwell ControlLogix

**PhaseManager** is Rockwell's implementation of ISA-88 within ControlLogix (Logix 5000) and FactoryTalk Batch.

### Key Concepts

1. **Phase Definition** — Engineer defines phase logic (ladder logic, structured text, or function blocks)
2. **State Machine** — PhaseManager enforces the ISA-88 Phase State Machine (see Section above)
3. **Data Exchange** — Phases read from and write to Equipment Module data structures in the PLC

### Equipment Modules in PhaseManager

Each EM instance has:
- **Parameters** — Setpoints, limits, thresholds
- **Feedback** — Current measured values from CMs
- **Status** — Current phase running, error flags, mode (Auto/Manual/Out-of-Service)
- **Phase Control** — Commands to execute phases and manage state

### Phase Execution Flow

1. **Preconditions Check** — Are all input conditions met?
2. **Phase Initialize** — Set initial values, arm timers, clear old faults
3. **Phase Execute** — Run the main control logic loop (read sensors, compare to setpoints, adjust outputs, check alarms)
4. **Phase Complete** — Completion condition met
5. **Phase Terminate** — Safely shut down hardware
6. **Post-Phase Actions** — Cleanup, logging, transition to next phase

---

## ISA-88 Training and Reference Materials

**SharePoint locations:**
- **RDC Renovations > 02 Design Basis** — ISA-88 training (including `01_S88-learning_NC.pdf` and Lab 06 - Building Logix-based Phases)
- **RDC Renovations > 04 Project Delivery** — ISA-88 design documents and FactoryTalk Batch config
- **RDC Renovations > 05 Commissioning** — EM Phase Summary spreadsheets
- **RDC Renovations > Documents** — Design Specifications ([PROJECT#]-DS-PRO-[SYSTEM]-001)
- **Process Engineering 2** — Batch procedures and operational documentation

---

## Common Questions

### Q: How do I find documentation on an Equipment Module?
1. Search **EM Phase Summary** spreadsheets on SharePoint at `RDC Renovations` → `05 Commissioning` (known versions: P2, P4, P6)
2. Read the **Design Specification** (`[PROJECT#]-DS-PRO-[SYSTEM]-001`), Equipment Modules section
3. Check the workspace CLAUDE.md's `## EQUIPMENT MODULES (EM) REFERENCE` section for the 8 core EMs and where to look for system-specific details
4. Review **Logix source code** for actual phase implementations

### Q: Can I modify a phase while a batch is running?
**No.** Risks: corrupting the batch record (FDA warning letter risk), uncontrolled hardware behavior, loss of traceability. Stop the batch cleanly, implement via change control, validate, then restart.

### Q: What happens when an EM faults?
EM fault → **Hold Phase Signal** to calling Phase → Phase transitions RUNNING → HOLDING → HELD → propagates up to OP hold → UP hold. The EM and its CMs reach a safe state.

---

## Related Resources

- **Workspace CLAUDE.md → `## EQUIPMENT MODULES (EM) REFERENCE`** — The 8 core EMs with their typical hardware, where EM Phase Summary spreadsheets live (P2, P4, P6 known), pointer back here for batch model concepts.
- **`sharepoint-search` skill** — Search SharePoint for formal docs (DSes, EM Phase Summaries, P&IDs, TSOPs, batch training).
- **Change controls** — Use `/add-project` to scaffold a new CC folder under your `Change Controls/` mount when a phase, EM, or batch procedure change requires EtQ submission.
