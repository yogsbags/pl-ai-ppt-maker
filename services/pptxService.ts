
import pptxgen from "pptxgenjs";
import { Presentation } from "../types";

export const exportToPptx = async (presentation: Presentation) => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  const primaryColor = presentation.branding?.primaryColor?.replace('#', '') || "6366F1";
  
  // 1. Title Slide
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: "020617" };
  
  if (presentation.branding?.logoUrl) {
    titleSlide.addImage({
      path: presentation.branding.logoUrl,
      x: 4.5, y: 0.5, w: 1, h: 0.5,
      sizing: { type: 'contain' }
    });
  }

  titleSlide.addText(presentation.title, {
    x: 0, y: 0, w: '100%', h: '100%',
    fontSize: 48, color: "FFFFFF", bold: true, align: "center", valign: "middle",
    fontFace: "Arial"
  });
  
  titleSlide.addText(presentation.oneLiner || presentation.branding?.slogan || "", {
    x: 1, y: 5.5, w: 8, h: 0.5,
    fontSize: 16, color: primaryColor, bold: true, align: "center", fontFace: "Arial"
  });

  titleSlide.addText(presentation.date || "", {
    x: 1, y: 6.0, w: 8, h: 0.5,
    fontSize: 12, color: "666666", align: "center", fontFace: "Arial"
  });

  // 2. Content Slides
  for (const slideData of presentation.slides) {
    const slide = pres.addSlide();
    
    if (slideData.imageUrl) {
      slide.background = { data: slideData.imageUrl };
      slide.addShape(pres.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: "000000", transparency: 50 }
      });
    } else {
      slide.background = { color: "0F172A" };
    }

    if (presentation.branding?.logoUrl) {
      slide.addImage({
        path: presentation.branding.logoUrl,
        x: 9, y: 5.0, w: 0.8, h: 0.4,
        sizing: { type: 'contain' }
      });
    }

    const isHero = slideData.layout === 'hero';

    slide.addText(slideData.title, {
      x: isHero ? 0.5 : 0.8, 
      y: isHero ? 1.5 : 0.6, 
      w: 8.4, 
      h: 1,
      fontSize: isHero ? 44 : 32, 
      color: "FFFFFF", 
      bold: true,
      align: isHero ? "center" : "left",
      fontFace: "Arial"
    });

    const bulletText = slideData.content.map(line => ({
      text: line,
      options: { bullet: true, fontSize: isHero ? 22 : 18, color: "E2E8F0", fontFace: "Arial" }
    }));

    slide.addText(bulletText, {
      x: isHero ? 0.5 : 0.8, 
      y: isHero ? 2.5 : 1.6, 
      w: 8.4, 
      h: 3.5,
      valign: "top",
      align: isHero ? "center" : "left"
    });
  }

  await pres.writeFile({ fileName: `${presentation.title.replace(/\s+/g, '_')}.pptx` });
};
