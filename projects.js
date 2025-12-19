// Add your projects here! Just copy a project object and fill in your details.
// For media, use either 'image' or 'video' and provide the path to your file.

const projects = [
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
        mediaSrc: "media/saomanysaos/sao-many-saos-badge-final-assembly-v0-56k7kgeqljgf1.webp",
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
