// ============================================================
// REBEL DESIGNS — Content Rotations
// Defines the 4-rotation fortnightly cycle.
// Each rotation has a copy prompt, image prompt, and CTA.
// ============================================================

export const ROTATIONS = [
  {
    id: "lab",
    name: "The Lab Showcase",
    description: "Promote live Rebel Designs lab tools",
    copyPrompt: `Write a social media post promoting one of Rebel Designs' live lab tools.
Tools available:
- Password Roast: rates password strength with brutal, witty commentary. URL: rebeldesigns.co.za/lab/password-roast
- Rebel T-T-T: a precision-designed tic-tac-toe game demonstrating UI craft. URL: rebeldesigns.co.za/lab

Highlight what the tool does, why it was built, and what it says about the studio's approach to craft.
End with a CTA linking to rebeldesigns.co.za/lab`,

    imagePrompt: `Neon-glitch laboratory aesthetic. Dark background (#080808). Glowing test tubes and circuit board elements in acid green (#C8FF00) and electric red (#FF2D2D). Pixel-art meets brutalist design. No text. 1:1 ratio. High contrast, sharp edges.`,
  },
  {
    id: "roast",
    name: "Industry Roast",
    description: "Sharp commentary on 2026 web trends",
    copyPrompt: `Write an opinionated social media post roasting or commenting on a current 2026 web industry trend.
Choose one topic (rotate through them, don't repeat):
- AI-native UI patterns making traditional navigation obsolete
- Edge computing killing the monolithic backend
- The death of the cookie-cutter Squarespace/Wix aesthetic
- Hydrogen (headless Shopify) becoming the new commerce standard
- Why most "AI websites" are just regular sites with a chatbot bolted on

Be opinionated. Be sharp. Not neutral. This is commentary, not journalism.
End with a subtle reference to rebeldesigns.co.za`,

    imagePrompt: `Brutalist web design aesthetic. Dark background. Glitch-art fire and broken screen elements in neon red (#FF2D2D) and electric yellow. Fragmented grid lines. Distorted pixels. Abstract, no text. 1:1 ratio. Raw and aggressive energy.`,
  },
  {
    id: "deep",
    name: "Deep Learning",
    description: "Educational web dev tip from /resources",
    copyPrompt: `Write an educational social media post sharing a genuine web development tip, pattern, or insight.
Topics to draw from:
- Performance optimization patterns (Core Web Vitals, lazy loading, edge caching)
- Shopify Hydrogen / headless architecture approaches
- CSS patterns and design system structure
- JavaScript/TypeScript patterns for clean, maintainable code
- WordPress custom development vs theme-shop builds

Make it immediately actionable. Real developers should learn something.
End with a CTA to rebeldesigns.co.za/resources`,

    imagePrompt: `Editorial code aesthetic. Dark terminal background (#0A0A0A). Glowing code snippets and geometric shapes in acid green (#C8FF00) and cool blue (#00D4FF). Clean, precise, technical. Abstract data visualization elements. No readable text. 1:1 ratio.`,
  },
  {
    id: "compliance",
    name: "Compliance Edge",
    description: "South African digital law & POPIA insights",
    copyPrompt: `Write a social media post sharing an insight about South African digital law relevant to businesses with websites.
Topics to cover (rotate through, don't repeat):
- POPIA data subject rights and what they demand from your website
- PAIA Section 51 requirements for websites and online businesses  
- What "processing personal data" actually means legally for a business website
- Why cookie consent banners alone are legally insufficient under POPIA
- What a POPIA-compliant contact form actually requires
- The difference between a Privacy Policy and a PAIA Manual

Position Rebel Designs as the studio that builds compliance in from day one, not as an afterthought.
End with a CTA to rebeldesigns.co.za`,

    imagePrompt: `South African legal-tech aesthetic. Dark background. Shield and lock iconography in gold (#FFB400) and white. Geometric, architectural forms suggesting protection and structure. Subtle South African flag colours as accent. Abstract, no text. 1:1 ratio. Authoritative and precise.`,
  },
];

// Returns the current rotation based on a persistent index stored in KV
export function getRotation(index) {
  return ROTATIONS[index % ROTATIONS.length];
}
