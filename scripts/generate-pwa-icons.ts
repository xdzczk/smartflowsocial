import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";

const publicDir = join(process.cwd(), "public");
const appIconPath = join(publicDir, "AppIcon.svg");

async function generateIcons() {
  try {
    const svgBuffer = readFileSync(appIconPath);

    // Generate apple-touch-icon.png (180x180) - required for iOS home screen
    const appleTouchIcon = await sharp(svgBuffer)
      .resize(180, 180, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();
    writeFileSync(join(publicDir, "apple-touch-icon.png"), appleTouchIcon);
    console.log("✓ Generated apple-touch-icon.png (180x180)");

    // Generate icon-192.png - standard PWA icon
    const icon192 = await sharp(svgBuffer)
      .resize(192, 192, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();
    writeFileSync(join(publicDir, "icon-192.png"), icon192);
    console.log("✓ Generated icon-192.png");

    // Generate icon-512.png - high-resolution PWA icon
    const icon512 = await sharp(svgBuffer)
      .resize(512, 512, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();
    writeFileSync(join(publicDir, "icon-512.png"), icon512);
    console.log("✓ Generated icon-512.png");

    console.log("\n✅ All PWA icons generated successfully!");
    console.log("📱 Icons are ready for iOS home screen and PWA installation.");
  } catch (error) {
    console.error("❌ Error generating icons:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
    process.exit(1);
  }
}

generateIcons();
