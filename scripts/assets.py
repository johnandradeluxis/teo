from PIL import Image, ImageDraw
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'mobile'/'resources';out.mkdir(parents=True,exist_ok=True)
for label,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192),('store',512)]:
    image=Image.new('RGB',(size,size),'#173e35')
    draw=ImageDraw.Draw(image)
    def rect(box): draw.rectangle(tuple(round(x*size/192) for x in box),fill='#eddfb8')
    rect((51,53,141,68));rect((87,65,105,139));rect((96,137,119,153))
    draw.ellipse(tuple(round(x*size/192) for x in (128,138,146,156)),fill='#eddfb8')
    image.save(out/f'icon-{label}.png')
    if label=='xxxhdpi':image.save(root/'public'/'icon-192.png')
    if label=='store':image.save(root/'public'/'icon-512.png')
image=Image.new('RGB',(1080,1920),'#173e35');icon=Image.open(out/'icon-store.png');image.paste(icon,((1080-512)//2,(1920-512)//2));image.save(out/'splash.png')
print('Ícones e splash gerados a partir da identidade vetorial do Teo.')
