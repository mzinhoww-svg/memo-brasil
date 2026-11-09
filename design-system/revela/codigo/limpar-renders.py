import cv2, numpy as np, json
R='/home/user/memo-brasil/design-system/revela/'
H=json.load(open('H.json'))
# caixas (coordenadas da textura 2600x1400, de wraps.py) dos textos que mudam por evento
BOX={
 'festa':[(1000,940,2570,1022),(1900,1190,2550,1272)],
 'casamento':[(1000,555,2590,818),(1015,842,2570,922),(2130,1190,2550,1272)],
 'aniversario':[(1000,930,2570,1016),(1650,1190,2550,1272)],
 'noite':[(1000,930,2570,1016)],
}
import os; os.makedirs(R+'3d/clean',exist_ok=True)
for w,boxes in BOX.items():
    ren=cv2.imread(R+f'3d/cam-{w}.png',cv2.IMREAD_UNCHANGED)
    m=np.zeros((1400,2600),np.uint8)
    for x0,y0,x1,y1 in boxes: m[y0:y1,x0:x1]=255
    mw=cv2.warpPerspective(m,np.array(H[w]),(ren.shape[1],ren.shape[0]))
    mw=cv2.dilate((mw>0).astype(np.uint8)*255,np.ones((3,3),np.uint8))
    rgb=cv2.inpaint(ren[:,:,:3],mw,9,cv2.INPAINT_TELEA)
    out=np.dstack([rgb,ren[:,:,3]])
    cv2.imwrite(R+f'3d/clean/cam-{w}.png',out)
    bg=np.full_like(rgb,(11,12,14)); a=ren[:,:,3:4]/255.0
    cv2.imwrite(f'clean-{w}.jpg',cv2.resize((rgb*a+bg*(1-a)).astype(np.uint8)[300:900,180:1020],(560,400)))
print('ok')
