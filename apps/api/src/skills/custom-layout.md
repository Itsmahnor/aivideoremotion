---
name: custom-layout
description: How to build good CustomScene layouts from layers
---

# When to use CustomScene
- Use a normal template when one fits the idea. Use CustomScene when the user asks for a layout or idea that no template shows.
- At most 3 CustomScene per video. The last scene is always CTAEndCard.

# Coordinates
- x, y, w, h are percent of the safe area, not the full frame. Keep x + w <= 100 and y + h <= 100.
- Leave about 4 percent gaps between layers. Layers must not cover each other, except a shape placed behind text as a card.
- Layer order matters: first layer is at the back, last is on top. Put shapes first, then text, then devices.

# Landscape (16:9)
- Two columns: text on the left (x 0, w 46 to 50), device or image on the right (x 52, w 48).
- Headline y 14 to 56, supporting text below it.

# Portrait (9:16) and square (1:1)
- Stack vertically. Never use two columns in 9:16.
- Headline y 6 to 30, device y 34 to 94 with w 90.

# Text
- Headline max 8 words, caption max 12 words. Big idea = size headline or display.
- Use only color tokens. Text on a primary shape uses onPrimary. Text on a surface or background shape uses text.

# Motion
- Stagger entrances by 0.3 to 0.6 seconds, in reading order.
- Use slide-left or slide-right for devices, slide-up for text, pop for counters and badges.

# Facts
- Use only facts and numbers the user gave. Never invent statistics for a counter.