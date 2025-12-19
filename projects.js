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
