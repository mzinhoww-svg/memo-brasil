import cv2, numpy as np, json, sys
R='/home/user/memo-brasil/design-system/revela/'
out={}
for w in ['festa','casamento','aniversario','noite']:
    tex=cv2.imread(R+f'embalagens/wrap-{w}.png'); ren=cv2.imread(R+f'3d/cam-{w}.png', cv2.IMREAD_UNCHANGED)
    rgb=ren[:,:,:3]
    sift=cv2.SIFT_create(8000)
    g1=cv2.cvtColor(tex,cv2.COLOR_BGR2GRAY); g2=cv2.cvtColor(rgb,cv2.COLOR_BGR2GRAY)
    k1,d1=sift.detectAndCompute(g1,None); k2,d2=sift.detectAndCompute(g2,None)
    m=cv2.BFMatcher().knnMatch(d1,d2,k=2)
    good=[a for a,b in m if a.distance<0.75*b.distance]
    src=np.float32([k1[a.queryIdx].pt for a in good]); dst=np.float32([k2[a.trainIdx].pt for a in good])
    H,mask=cv2.findHomography(src,dst,cv2.RANSAC,3.0)
    inl=int(mask.sum()) if mask is not None else 0
    corners=cv2.perspectiveTransform(np.float32([[0,0],[2600,0],[2600,1400],[0,1400]]).reshape(-1,1,2),H).reshape(-1,2)
    print(w,len(good),'inliers',inl,'corners',corners.round(1).tolist())
    out[w]=H.tolist()
    # verificação: projeta a textura sobre o render
    warp=cv2.warpPerspective(tex,H,(rgb.shape[1],rgb.shape[0]))
    vis=cv2.addWeighted(rgb,0.5,warp,0.5,0)
    cv2.imwrite(f'check-{w}.jpg',cv2.resize(vis,(600,600)))
json.dump(out,open('H.json','w'))
