// Add your projects here! Just copy a project object and fill in your details.
// For media, use either 'image' or 'video' and provide the path to your file.

const projects = [
    {
        title: "Claude Artifact Project",
        description: "A project shared via a Claude public artifact link.",
        date: "2026",
        mediaType: "image",
        mediaSrc: "https://claude.ai/public/artifacts/6fb2ae85-980f-4e4c-99a8-c07af34b500b",
        tags: ["Claude", "Artifact", "AI"],
        fullWriteup: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FRC 2026 REBUILT - Complete Cheat Sheet | Team 5940 BREAD</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 9pt;
            line-height: 1.3;
            color: #1a1a1a;
            background: #fff;
        }
        .page {
            width: 8.5in;
            min-height: 11in;
            padding: 0.4in;
            margin: 0 auto;
            background: white;
            page-break-after: always;
        }
        @media print {
            body { background: white; }
            .page { 
                padding: 0.3in; 
                margin: 0;
                page-break-after: always;
            }
        }
        h1 {
            font-size: 18pt;
            color: #1a1a1a;
            text-align: center;
            margin-bottom: 8px;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 5px;
        }
        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 12px;
            font-size: 10pt;
        }
        h2 {
            font-size: 11pt;
            color: #fff;
            background: #0066cc;
            padding: 4px 8px;
            margin: 10px 0 6px 0;
            border-radius: 3px;
        }
        h3 {
            font-size: 9.5pt;
            color: #0066cc;
            margin: 8px 0 4px 0;
            border-bottom: 1px solid #ccc;
        }
        .columns {
            display: flex;
            gap: 12px;
        }
        .col {
            flex: 1;
        }
        .col-60 { flex: 0 0 58%; }
        .col-40 { flex: 0 0 40%; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 4px 0;
            font-size: 8.5pt;
        }
        th, td {
            border: 1px solid #ccc;
            padding: 3px 5px;
            text-align: left;
        }
        th {
            background: #e8f0fe;
            font-weight: 600;
        }
        .highlight {
            background: #fff3cd;
        }
        .important {
            background: #f8d7da;
        }
        .good {
            background: #d4edda;
        }
        ul {
            margin: 4px 0 4px 16px;
        }
        li {
            margin: 2px 0;
        }
        .box {
            border: 1px solid #ccc;
            padding: 6px;
            margin: 6px 0;
            border-radius: 4px;
            background: #f9f9f9;
        }
        .box-blue {
            border-color: #0066cc;
            background: #e8f0fe;
        }
        .box-red {
            border-color: #dc3545;
            background: #f8d7da;
        }
        .box-green {
            border-color: #28a745;
            background: #d4edda;
        }
        .box-yellow {
            border-color: #ffc107;
            background: #fff3cd;
        }
        .big-number {
            font-size: 14pt;
            font-weight: bold;
            color: #0066cc;
        }
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .grid-3 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
        }
        .center {
            text-align: center;
        }
        .bold {
            font-weight: 600;
        }
        .small {
            font-size: 8pt;
            color: #666;
        }
        .tag {
            display: inline-block;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 7.5pt;
            font-weight: 600;
        }
        .tag-red { background: #dc3545; color: white; }
        .tag-blue { background: #0066cc; color: white; }
        .tag-yellow { background: #ffc107; color: black; }
        .tag-green { background: #28a745; color: white; }
    </style>
</head>
<body>

<!-- PAGE 1 -->
<div class="page">
    <h1>🤖 FRC 2026 REBUILT™ - Complete Cheat Sheet</h1>
    <div class="subtitle">Team 5940 BREAD | Kickoff January 10, 2026 | Presented by Haas</div>

    <div class="columns">
        <div class="col-60">
            <h2>📋 GAME OVERVIEW</h2>
            <div class="box box-blue">
                <strong>Objective:</strong> Score FUEL into your HUB, cross obstacles, and climb the TOWER before time runs out. Alliance with most points wins!
            </div>
            
            <h3>Match Structure (2:40 Total)</h3>
            <table>
                <tr>
                    <th>Period</th>
                    <th>Duration</th>
                    <th>Timer</th>
                    <th>Key Actions</th>
                </tr>
                <tr class="highlight">
                    <td><strong>AUTO</strong></td>
                    <td>20 sec</td>
                    <td>0:20→0:00</td>
                    <td>No driver control, pre-programmed only</td>
                </tr>
                <tr>
                    <td>TRANSITION</td>
                    <td>10 sec</td>
                    <td>2:20→2:10</td>
                    <td>Both HUBs active</td>
                </tr>
                <tr>
                    <td>SHIFT 1</td>
                    <td>25 sec</td>
                    <td>2:10→1:45</td>
                    <td rowspan="4">HUBs alternate active/inactive</td>
                </tr>
                <tr>
                    <td>SHIFT 2</td>
                    <td>25 sec</td>
                    <td>1:45→1:20</td>
                </tr>
                <tr>
                    <td>SHIFT 3</td>
                    <td>25 sec</td>
                    <td>1:20→0:55</td>
                </tr>
                <tr>
                    <td>SHIFT 4</td>
                    <td>25 sec</td>
                    <td>0:55→0:30</td>
                </tr>
                <tr class="good">
                    <td><strong>END GAME</strong></td>
                    <td>30 sec</td>
                    <td>0:30→0:00</td>
                    <td>Both HUBs active, climb!</td>
                </tr>
            </table>

            <h3>⚡ HUB Activation (KEY MECHANIC)</h3>
            <div class="box box-yellow">
                <strong>Whoever scores MORE FUEL in AUTO → their HUB goes INACTIVE first in Shift 1</strong>
                <br>HUBs then alternate every shift. <em>Tied AUTO = random selection.</em>
            </div>
            <table>
                <tr>
                    <th>If RED wins AUTO</th>
                    <th>SHIFT 1</th>
                    <th>SHIFT 2</th>
                    <th>SHIFT 3</th>
                    <th>SHIFT 4</th>
                </tr>
                <tr>
                    <td>RED HUB</td>
                    <td class="important">Inactive</td>
                    <td class="good">Active</td>
                    <td class="important">Inactive</td>
                    <td class="good">Active</td>
                </tr>
                <tr>
                    <td>BLUE HUB</td>
                    <td class="good">Active</td>
                    <td class="important">Inactive</td>
                    <td class="good">Active</td>
                    <td class="important">Inactive</td>
                </tr>
            </table>
        </div>

        <div class="col-40">
            <h2>🎯 SCORING POINTS</h2>
            <table>
                <tr>
                    <th>Action</th>
                    <th>AUTO</th>
                    <th>TELEOP</th>
                </tr>
                <tr>
                    <td>FUEL in <strong>active</strong> HUB</td>
                    <td class="center"><span class="big-number">1</span></td>
                    <td class="center"><span class="big-number">1</span></td>
                </tr>
                <tr class="important">
                    <td>FUEL in <strong>inactive</strong> HUB</td>
                    <td class="center">0</td>
                    <td class="center">0</td>
                </tr>
                <tr>
                    <td>LEVEL 1 climb</td>
                    <td class="center"><span class="big-number">15</span></td>
                    <td class="center"><span class="big-number">10</span></td>
                </tr>
                <tr>
                    <td>LEVEL 2 climb</td>
                    <td class="center">—</td>
                    <td class="center"><span class="big-number">20</span></td>
                </tr>
                <tr>
                    <td>LEVEL 3 climb</td>
                    <td class="center">—</td>
                    <td class="center"><span class="big-number">30</span></td>
                </tr>
            </table>

            <h3>🏆 Ranking Points (RP)</h3>
            <table>
                <tr><th>RP Type</th><th>Requirement</th><th>RP</th></tr>
                <tr><td>Win</td><td>More points than opponent</td><td class="center">3</td></tr>
                <tr><td>Tie</td><td>Same points</td><td class="center">1</td></tr>
                <tr class="highlight"><td>ENERGIZED</td><td>≥100 FUEL scored</td><td class="center">1</td></tr>
                <tr class="highlight"><td>SUPERCHARGED</td><td>≥360 FUEL scored</td><td class="center">1</td></tr>
                <tr class="highlight"><td>TRAVERSAL</td><td>≥50 TOWER points</td><td class="center">1</td></tr>
            </table>
            <p class="small">*Thresholds may increase at Championships (TBA)</p>

            <h3>⚠️ Penalties</h3>
            <table>
                <tr><td>MINOR FOUL</td><td class="center">5 pts to opponent</td></tr>
                <tr><td>MAJOR FOUL</td><td class="center">15 pts to opponent</td></tr>
                <tr class="important"><td>YELLOW CARD</td><td>Warning (2nd = RED)</td></tr>
                <tr class="important"><td>RED CARD</td><td>DISQUALIFIED</td></tr>
            </table>
        </div>
    </div>

    <h2>📐 FIELD & ELEMENT DIMENSIONS</h2>
    <div class="grid-3">
        <div class="box">
            <h3>Field</h3>
            <ul>
                <li><strong>Size:</strong> 317.7" × 651.2" (~26.5' × 54.3')</li>
                <li><strong>Surface:</strong> Low pile carpet (Shaw Neyland II)</li>
                <li><strong>Gate width:</strong> 38.0" opening</li>
            </ul>
        </div>
        <div class="box">
            <h3>HUB</h3>
            <ul>
                <li><strong>Structure:</strong> 47" × 47" rectangular prism</li>
                <li><strong>Opening:</strong> 41.7" hexagonal at top</li>
                <li><strong>Height:</strong> 72" (6 ft) to front edge</li>
                <li><strong>Distance from wall:</strong> 158.6"</li>
            </ul>
        </div>
        <div class="box">
            <h3>TOWER (Climbing)</h3>
            <ul>
                <li><strong>LOW RUNG:</strong> 27.0" from floor</li>
                <li><strong>MID RUNG:</strong> 45.0" from floor</li>
                <li><strong>HIGH RUNG:</strong> 63.0" from floor</li>
                <li><strong>Rung spacing:</strong> 18.0" apart</li>
                <li><strong>Rung OD:</strong> 1.66" (1-1/4" Sch 40)</li>
            </ul>
        </div>
    </div>
    <div class="grid-3">
        <div class="box">
            <h3>FUEL (Scoring Element)</h3>
            <ul>
                <li><strong>Diameter:</strong> 5.91" (15.0 cm)</li>
                <li><strong>Material:</strong> High density foam ball</li>
                <li><strong>Weight:</strong> 0.448-0.500 lb</li>
                <li><strong>Preload:</strong> Up to 8 per robot</li>
            </ul>
        </div>
        <div class="box">
            <h3>BUMP</h3>
            <ul>
                <li><strong>Size:</strong> 73.0" × 44.4" × 6.5" tall</li>
                <li><strong>Location:</strong> Either side of HUBs</li>
            </ul>
        </div>
        <div class="box">
            <h3>TRENCH</h3>
            <ul>
                <li><strong>Clearance:</strong> 50.34" wide × 22.25" tall</li>
            </ul>
        </div>
    </div>
</div>

<!-- PAGE 2 -->
<div class="page">
    <h1>🤖 ROBOT RULES & SPECIFICATIONS</h1>
    
    <div class="columns">
        <div class="col">
            <h2>📏 SIZE CONSTRAINTS</h2>
            <div class="box box-red">
                <div class="grid-2">
                    <div>
                        <p><strong>STARTING CONFIG:</strong></p>
                        <ul>
                            <li>Perimeter: <span class="big-number">≤110"</span></li>
                            <li>Height: <span class="big-number">≤30"</span></li>
                        </ul>
                    </div>
                    <div>
                        <p><strong>EXTENSION LIMITS:</strong></p>
                        <ul>
                            <li>Horizontal: <span class="big-number">≤12"</span> beyond perimeter</li>
                            <li>Height: <span class="big-number">≤30"</span> (always)</li>
                            <li>Only 1 direction at a time!</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <h3>Weight</h3>
            <div class="box">
                <p><strong>Max weight:</strong> <span class="big-number">115.0 lb</span> (52.16 kg)</p>
                <p class="small"><strong>Excludes:</strong> Bumpers, battery + Anderson connector, event-provided tracking tags</p>
            </div>

            <h2>🛡️ BUMPER RULES</h2>
            <table>
                <tr><th>Rule</th><th>Specification</th></tr>
                <tr><td>Coverage</td><td>Protect all corners, ≥5" on each side of corner</td></tr>
                <tr><td>Extension from frame</td><td>≤4.0" outward</td></tr>
                <tr><td>Hard parts limit</td><td>≤1.25" from frame</td></tr>
                <tr><td>BUMPER ZONE</td><td>3.5" to 8.5" above floor</td></tr>
                <tr><td>Backing</td><td>3/4" plywood (must support full length)</td></tr>
                <tr><td>Padding</td><td>2.5" pool noodle minimum</td></tr>
                <tr><td>Fabric</td><td>Must cover padding, Alliance color</td></tr>
            </table>

            <h2>⚡ POWER & MOTORS</h2>
            <h3>Allowed Motors (No Limit)</h3>
            <ul>
                <li>REV NEO, NEO 550, NEO Vortex</li>
                <li>Falcon 500, Kraken X60, Kraken X44</li>
                <li>CIM, Mini CIM, BAG, 775pro</li>
                <li>AndyMark 9015, RedLine, NeveRest</li>
            </ul>
            <h3>Limited Motors</h3>
            <ul>
                <li>Servo motors (any qty, must be ≤60W)</li>
                <li>PWM-controlled fans (≤10W each)</li>
            </ul>
        </div>

        <div class="col">
            <h2>🎮 DRIVE TEAM</h2>
            <table>
                <tr><th>Role</th><th>Count</th><th>Location</th></tr>
                <tr><td>DRIVER</td><td>1-2</td><td>Behind HUMAN STARTING LINE</td></tr>
                <tr><td>HUMAN PLAYER</td><td>1</td><td>OUTPOST area (can enter FUEL)</td></tr>
                <tr><td>COACH</td><td>1</td><td>Behind HUMAN STARTING LINE</td></tr>
                <tr><td>TECHNICIAN</td><td>1</td><td>TECHNICIAN area (not during match)</td></tr>
            </table>
            <p class="small">Max 5 team members total. All except TECHNICIAN behind line during AUTO.</p>

            <h2>🏁 CLIMBING CRITERIA</h2>
            <table>
                <tr>
                    <th>Level</th>
                    <th>Requirement</th>
                    <th>AUTO</th>
                    <th>TELEOP</th>
                </tr>
                <tr>
                    <td><strong>LEVEL 1</strong></td>
                    <td>Not touching CARPET or TOWER BASE</td>
                    <td>15 pts</td>
                    <td>10 pts</td>
                </tr>
                <tr>
                    <td><strong>LEVEL 2</strong></td>
                    <td>BUMPERS completely above LOW RUNG (27")</td>
                    <td>—</td>
                    <td>20 pts</td>
                </tr>
                <tr>
                    <td><strong>LEVEL 3</strong></td>
                    <td>BUMPERS completely above MID RUNG (45")</td>
                    <td>—</td>
                    <td>30 pts</td>
                </tr>
            </table>
            <div class="box box-yellow">
                <strong>Climbing Contact Rules:</strong> Must contact RUNGS or UPRIGHTS. May also contact: TOWER WALL, support structure, FUEL, another ROBOT. Max 2 robots at LEVEL 1 in AUTO.
            </div>

            <h2>🚫 KEY GAME RULES</h2>
            <div class="box box-red">
                <h3>Major Fouls (15 pts to opponent)</h3>
                <ul>
                    <li><strong>G403:</strong> In AUTO, crossing CENTER LINE and contacting opponent</li>
                    <li><strong>G407:</strong> Shooting at HUB from outside your ALLIANCE ZONE</li>
                    <li><strong>G404:</strong> Using FUEL to ease/amplify field challenges</li>
                    <li><strong>G408:</strong> Catching FUEL from HUB strategically</li>
                </ul>
            </div>
            <div class="box">
                <h3>Minor Fouls (5 pts to opponent)</h3>
                <ul>
                    <li><strong>G401:</strong> Crossing HUMAN STARTING LINE in AUTO</li>
                    <li><strong>G405:</strong> Ejecting SCORING ELEMENTS from FIELD</li>
                </ul>
            </div>
            <div class="box box-yellow">
                <h3>DISABLED Violations</h3>
                <ul>
                    <li><strong>G409:</strong> Robot poses safety hazard, bumpers fail/detach, bumpers leave zone</li>
                    <li><strong>G414:</strong> Fully supporting weight of alliance robot to climb</li>
                </ul>
            </div>
        </div>
    </div>
</div>

<!-- PAGE 3 -->
<div class="page">
    <h1>🍞 TEAM 5940 BREAD - STRATEGY & PREDICTIONS</h1>
    
    <div class="columns">
        <div class="col">
            <h2>💪 5940 STRENGTHS (Based on History)</h2>
            <table>
                <tr><th>Strength</th><th>Evidence</th></tr>
                <tr class="good"><td>Elite Autonomous</td><td>Won Auto Award at every regional 2022-2024</td></tr>
                <tr class="good"><td>Strong Software/Controls</td><td>Innovation in Control Award, custom path following</td></tr>
                <tr class="good"><td>Reliable Shooters</td><td>2022 dual flywheel with adjustable hood</td></tr>
                <tr class="good"><td>Climber Experience</td><td>5-sec high climb in 2022 (traversal-capable)</td></tr>
                <tr class="good"><td>Swerve Drive</td><td>Running swerve since 2022+</td></tr>
            </table>

            <h2>⏱️ TARGET CYCLE TIMES</h2>
            <table>
                <tr><th>Action</th><th>Target</th><th>Stretch</th></tr>
                <tr><td>Full cycle (intake→score)</td><td>4-6 sec</td><td>3-4 sec</td></tr>
                <tr><td>Ground intake</td><td>0.5-1 sec</td><td>0.3 sec</td></tr>
                <tr><td>Drive to shooting position</td><td>1.5-2.5 sec</td><td>1 sec</td></tr>
                <tr><td>Aim + shoot</td><td>1-2 sec</td><td>0.5-1 sec</td></tr>
                <tr><td>Return to pickup</td><td>1.5-2.5 sec</td><td>1 sec</td></tr>
            </table>

            <h2>🎯 AUTO TARGETS (20 sec)</h2>
            <div class="box box-green">
                <p><strong>Goal: WIN AUTO every match</strong> (controls hub timing)</p>
                <table>
                    <tr><th>Action</th><th>Time</th></tr>
                    <tr><td>Preload + 1 shot</td><td>2-3 sec</td></tr>
                    <tr><td>Drive to center pickup</td><td>2-3 sec</td></tr>
                    <tr><td>Intake FUEL (each)</td><td>0.5-1 sec</td></tr>
                    <tr><td>Return & shoot cycle</td><td>3-4 sec each</td></tr>
                    <tr><td>Level 1 climb (if time)</td><td>3-5 sec</td></tr>
                </table>
                <p class="bold">Target: 8-12 FUEL + possible Level 1 (15 pts)</p>
            </div>

            <h2>📊 MATCH SCORING PROJECTION</h2>
            <table>
                <tr><th>Period</th><th>Duration</th><th>Target Output</th></tr>
                <tr><td>AUTO</td><td>20 sec</td><td>10-12 FUEL + Level 1 (15 pts)</td></tr>
                <tr><td>Transition</td><td>10 sec</td><td>Collect FUEL</td></tr>
                <tr><td>Shifts 1-4</td><td>100 sec</td><td>25-35 FUEL (hub ~50% active)</td></tr>
                <tr><td>End Game</td><td>30 sec</td><td>Level 2 (8-10 sec) + 4-6 FUEL</td></tr>
                <tr class="highlight"><td><strong>TOTAL</strong></td><td>160 sec</td><td><strong>~40-50 FUEL + 35-45 tower pts</strong></td></tr>
            </table>
        </div>

        <div class="col">
            <h2>🧗 CLIMBING ROI ANALYSIS</h2>
            <table>
                <tr><th>Level</th><th>Points</th><th>Time</th><th>ROI (pts/sec)</th></tr>
                <tr><td>Level 1</td><td>10 pts</td><td>3-5 sec</td><td class="good">2-3 pts/sec</td></tr>
                <tr><td>Level 2</td><td>20 pts</td><td>8-12 sec</td><td class="highlight">1.7-2.5 pts/sec</td></tr>
                <tr><td>Level 3</td><td>30 pts</td><td>15-25 sec</td><td>1.2-2 pts/sec</td></tr>
            </table>
            <div class="box box-blue">
                <strong>Recommendation:</strong> Unless Level 3 takes &lt;15 sec reliably, Level 2 + extra shooting cycles likely scores more.
            </div>

            <h2>🏆 RP THRESHOLD STRATEGY</h2>
            <table>
                <tr><th>RP</th><th>Threshold</th><th>Per Robot</th><th>Difficulty</th></tr>
                <tr class="good"><td>ENERGIZED</td><td>100 FUEL</td><td>~33 each</td><td><span class="tag tag-green">Achievable</span></td></tr>
                <tr class="important"><td>SUPERCHARGED</td><td>360 FUEL</td><td>~120 each</td><td><span class="tag tag-red">Very Hard</span></td></tr>
                <tr class="highlight"><td>TRAVERSAL</td><td>50 tower pts</td><td>2×L2 or L3+L1</td><td><span class="tag tag-yellow">Moderate</span></td></tr>
            </table>

            <h2>📋 MATCH FLOW STRATEGY</h2>
            <div class="box">
                <ol>
                    <li><strong>AUTO:</strong> Score 10+ FUEL → win auto → your hub inactive first in Shift 1</li>
                    <li><strong>Shift 1 (inactive):</strong> Collect FUEL from field, light defense if needed</li>
                    <li><strong>Shifts 2-4:</strong> Alternate shooting/collecting based on hub status</li>
                    <li><strong>End Game:</strong> Quick climb to Level 2, then keep shooting until 0:00</li>
                </ol>
            </div>

            <h2>🔧 DESIGN RECOMMENDATIONS</h2>
            <div class="grid-2">
                <div class="box">
                    <h3>Shooter</h3>
                    <ul>
                        <li>Dual flywheel or single + hood</li>
                        <li>Similar to 2022 Brioche</li>
                        <li>Target: 6ft shot to HUB</li>
                    </ul>
                </div>
                <div class="box">
                    <h3>Indexer</h3>
                    <ul>
                        <li>High capacity (3-5+ FUEL)</li>
                        <li>5.91" ball is smaller than 2022</li>
                        <li>Fast feeding critical</li>
                    </ul>
                </div>
                <div class="box">
                    <h3>Intake</h3>
                    <ul>
                        <li>Ground pickup priority</li>
                        <li>Center field fastest resupply</li>
                        <li>Consider over-bumper</li>
                    </ul>
                </div>
                <div class="box">
                    <h3>Climber</h3>
                    <ul>
                        <li>Level 2 minimum</li>
                        <li>Target &lt;10 sec climb</li>
                        <li>Similar to 2022 arms</li>
                    </ul>
                </div>
            </div>

            <h2>📱 QUICK REFERENCE</h2>
            <div class="box box-blue">
                <div class="grid-2">
                    <div>
                        <p><strong>Robot Max:</strong></p>
                        <ul>
                            <li>110" perimeter</li>
                            <li>30" height</li>
                            <li>115 lb weight</li>
                            <li>12" extension</li>
                        </ul>
                    </div>
                    <div>
                        <p><strong>Key Heights:</strong></p>
                        <ul>
                            <li>HUB opening: 72"</li>
                            <li>LOW RUNG: 27"</li>
                            <li>MID RUNG: 45"</li>
                            <li>HIGH RUNG: 63"</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <div class="center small" style="margin-top: 10px;">
        FRC 2026 REBUILT™ Cheat Sheet | Team 5940 BREAD | Generated January 10, 2026 | V0 - Kickoff
    </div>
</div>

</body>
</html>
         
        `
    },
    {
        title: "LED Deadmau5 Helmet",
        description: "Custom-built LED helmet featuring WLED addressable RGB strips, sound-reactive lighting, and 3D-printed construction. Powered by a 300W battery with full color control. Sold for $700.",
        date: "2025",
        mediaType: "image",
        mediaSrc: "media/helmet-red-led.jpg",
        tags: ["3D Printing", "LEDs", "Wearables", "Electronics", "WLED"],
        fullWriteup: `
            <h2>Technical Details</h2>
            <p>The lights are powered by WLED controller which I bought on Amazon for $30 and I soldered these addressable RGB strips to.</p>

            <p>It is sound reactive because it has a small microphone in it, and is great for wall displays but I was not able to get it to function well when walking around.</p>

            <p>To power it, I am carrying a 300W Anker backup battery. I easily could have gotten a less powerful/easier to handle battery, but because I already owned this and didn't want to spend any more money, I decided to go with this option. The WLED controller and LEDs run at 12 volts so I had to use a wall plug to power it. But this was okay because I'm now using this as a wall display.</p>

            <p><strong>Sadly I cannot take any more photos of it because I sold it to someone for roughly $700, but I might make a second one.</strong></p>

            <h2>3D Printing</h2>
            <p>I 3D printed this on a Prusa XL and my Bambu Labs P1P, and separated the parts into six different major pieces plus the mesh. I used dovetails to make connections easier and then I melted them together using a soldering iron and a little bit of glue. The ears I printed using lightweight PLA and I attached to the head using epoxy glue and two large bolts I had lying around.</p>

            <h2>Painting</h2>
            <p>I used about one can of Duplicolor automotive primer on this head after spending a little bit of time sanding, and it looked pretty good. Then I used black spray paint to give it the black color and then on top of that I used graphite powder to make it silverish which you can see in some of the photos with more light. To lock in the graphite powder I sprayed some 2K clear coat on top of it which made it look pretty good.</p>

            <h2>Final Assembly</h2>
            <p>I got a hard hat from my local neighborhood Facebook group for free, and then I used a Dremel to cut out the brim, the sides and some of the other large areas, along with cutting two large rectangles in it so that it could go through the big ear slots. I glued it in using two-part epoxy and epoxy putty, and a lot of clamps, prayers and duct tape.</p>

            <h2>Photo & Video Gallery</h2>
            <p>Here are more photos and videos of the helmet in action!</p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0;">
                <img src="media/WhatsApp Image 2025-12-18 at 18.16.33.jpeg" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
                <img src="media/WhatsApp Image 2025-12-18 at 18.16.33 (1).jpeg" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
                <img src="media/WhatsApp Image 2025-12-18 at 18.16.33 (2).jpeg" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
                <img src="media/WhatsApp Image 2025-12-18 at 18.16.33 (3).jpeg" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
                <img src="media/WhatsApp Image 2025-12-18 at 18.16.33 (4).jpeg" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
                <img src="media/WhatsApp Image 2025-12-18 at 18.16.33 (5).jpeg" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
                <img src="media/WhatsApp Image 2025-12-18 at 18.16.33 (6).jpeg" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
                <img src="media/ama-about-my-3d-printed-deadmau5-helmet-v0-gvm5k24pnc2g1.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
                <img src="media/ama-about-my-3d-printed-deadmau5-helmet-v0-mi3koo1pnc2g1.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
                <img src="media/ama-about-my-3d-printed-deadmau5-helmet-v0-mnqnxeponc2g1.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
                <img src="media/ama-about-my-3d-printed-deadmau5-helmet-v0-nxibaufonc2g1.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
                <img src="media/ama-about-my-3d-printed-deadmau5-helmet-v0-ur5uyhionc2g1.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Deadmau5 helmet">
            </div>

            <h3 style="color: #00d4ff; margin-top: 30px; margin-bottom: 15px;">Videos</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin: 20px 0;">
                <video controls style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;">
                    <source src="media/WhatsApp Video 2025-12-18 at 18.16.33.mp4" type="video/mp4">
                </video>
                <video controls style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;">
                    <source src="media/WhatsApp Video 2025-12-18 at 18.16.33 (1).mp4" type="video/mp4">
                </video>
                <video controls style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;">
                    <source src="media/WhatsApp Video 2025-12-18 at 18.16.33 (2).mp4" type="video/mp4">
                </video>
            </div>
        `
    },
    {
        title: "SAO MANY SAOs — DEF CON Badge",
        description: "A large-format SAO host badge supporting 25 SAO connectors simultaneously. Built around SAOv1.69bis standard with dual 18650 batteries, USB charging, and addressable LEDs. Designed, manufactured, and sold at DEF CON.",
        date: "2025",
        mediaType: "image",
        mediaSrc: "media/saomanysaos/extra-badges-v0-n7fi99pc3slf1.webp",
        tags: ["PCB Design", "Electronics", "DEF CON", "Hardware", "LEDs", "Badge"],
        fullWriteup: `
            <h2>SAO MANY SAOs — How I Built It</h2>
            <p>I built SAO MANY SAOs because I had a simple problem: I'd collected a bunch of SAOs, and there was no good way to power and display them all at once. Most badges support one or two SAOs. I wanted something that could handle all of them—at the same time—without being fragile or just decorative.</p>

            <p>That idea became SAO MANY SAOs, a badge designed to support 25 SAO connectors on a single board.</p>

            <h2>What the Badge Is</h2>
            <p>SAO MANY SAOs is basically a large-format SAO host badge built around the SAOv1.69bis standard. It has 25 SAO ports laid out so each SAO is visible and usable at the same time. The goal wasn't just to mount SAOs—it was to actually power them reliably and make them feel like part of one system.</p>

            <p>The badge runs on two 18650 batteries, which gives it enough capacity to power many SAOs simultaneously without browning out or acting weird. It can also be powered and charged over USB, with onboard charge management and status LEDs.</p>

            <p>Around the edge, I added addressable LEDs. On their own they're just a visual frame, but when you plug in a SmartAO, they unlock more interesting animations and behavior.</p>

            <h2>How I Built It</h2>
            <p>When I started, I didn't know how to design a production-ready PCB at this scale. I learned by doing—watching tutorials, asking questions in Discord servers, and iterating quickly. A lot of the early work was just figuring out how to route power safely across a large board and keep signals clean when you have that many connectors.</p>

            <p>The layout was the hardest part. Supporting 25 SAOs meant thinking carefully about spacing, mechanical stress, and how people would physically plug things in without snapping headers. Power distribution was another challenge—SAOs vary a lot in current draw, so I needed a design that could handle worst-case scenarios without failing.</p>

            <p>Once I had a working design, I ordered prototypes and tested them with real SAOs. That meant plugging in combinations of high-draw and low-draw modules, checking voltage stability, and making sure everything behaved consistently. Based on testing and feedback, I made revisions before moving to production.</p>

            <h2>Assembly and Production</h2>
            <p>For final assembly, I handled most of the process myself, with help soldering and prepping units for distribution. Every board was tested to make sure power, charging, and SAO connections worked correctly before shipping.</p>

            <p>This wasn't mass-manufactured—I was involved in every step, from PCB design to logistics. That includes packaging, pricing, and figuring out how to actually get badges into people's hands at DEF CON.</p>

            <h2>Launch and Community Response</h2>
            <p>I shared the project on Reddit and in the DEF CON badgelife community. The response was really positive, especially from people who already owned lots of SAOs and had never had a way to display them all at once.</p>

            <p>A lot of people were surprised when they found out I'm 14, but honestly the age wasn't the point. The project worked because it solved a real problem and because I took it seriously as an engineering and logistics challenge.</p>

            <h2>Why I'm Proud of It</h2>
            <p>SAO MANY SAOs isn't just a novelty. It's a functional, reliable platform for SAOs that didn't exist before. It pushed me to learn PCB design, power management, manufacturing constraints, and how to ship a real hardware product to real users.</p>

            <p>Most importantly, it's something people actually use at DEF CON—and that matters more to me than anything else.</p>

            <h2>Photo Gallery</h2>
            <p>Here are more photos of the badge development, assembly, and final product!</p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0;">
                <img src="media/saomanysaos/sao-many-saos-badge-final-assembly-v0-56k7kgeqljgf1.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="SAO MANY SAOs Badge">
                <img src="media/saomanysaos/sao-many-saos-badge-final-assembly-v0-048zlgnpljgf1.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="SAO MANY SAOs Badge">
                <img src="media/saomanysaos/sao-many-saos-badge-final-assembly-v0-5mdjg32qljgf1.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="SAO MANY SAOs Badge">
                <img src="media/saomanysaos/sao-many-saos-badge-update-v0-ebm0hce1x58f1.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="SAO MANY SAOs Badge Update">
                <img src="media/saomanysaos/image_2025-05-27_171646045.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="SAO MANY SAOs Badge">
                <img src="media/saomanysaos/extra-badges-v0-n7fi99pc3slf1.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="Extra badges">
                <img src="media/saomanysaos/IMG_3302.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="SAO MANY SAOs">
                <img src="media/saomanysaos/IMG_3310.webp" style="width: 100%; border-radius: 8px; border: 1px solid #00ff88;" alt="SAO MANY SAOs">
            </div>
        `
    },
    // Add more projects below - just copy the format above!
    // {
    //     title: "Your Project Name",
    //     description: "Brief description shown on card",
    //     date: "Month Year",
    //     mediaType: "image", // or "video"
    //     mediaSrc: "media/your-file.jpg",
    //     tags: ["Tag1", "Tag2"],
    //     fullWriteup: `
    //         <h2>Section Title</h2>
    //         <p>Your detailed write-up here with HTML formatting.</p>
    //         <p>Add multiple paragraphs, lists, etc.</p>
    //     `
    // },
];
