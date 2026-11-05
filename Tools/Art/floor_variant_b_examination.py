from PIL import Image; import numpy as np
A=np.asarray(Image.open('floor_block_A.png').convert('RGB')).astype(np.float32)
B=A[::-1, ::-1].copy()   # 180 Grad gedreht: Schachbrett-Paritaet bleibt erhalten, Flecken liegen anders
rng=np.random.default_rng(7); h,w,_=B.shape; yy,xx=np.mgrid[0:h,0:w]
def blot(cx,cy,r,strength):
    m=np.zeros((h,w),np.float32)
    for _ in range(9):
        ox,oy=rng.normal(0,r*0.45,2); rr=r*rng.uniform(0.35,0.8)
        m+=np.exp(-(((xx-cx-ox)**2+(yy-cy-oy)**2)/(2*rr*rr)))
    m=np.clip(m/m.max(),0,1)
    noise=np.asarray(Image.fromarray((rng.random((h//8,w//8))*255).astype(np.uint8)).resize((w,h),Image.BICUBIC)).astype(np.float32)/255
    return (np.clip(m*(0.6+0.6*noise)-0.15,0,1)*strength)[...,None]
out=B.copy()
for cx,cy,r,col,s in [(120,300,38,(150,110,55),0.35),(310,110,30,(70,64,58),0.30),(250,250,22,(120,140,70),0.25),(60,70,18,(70,64,58),0.25)]:
    m=blot(cx,cy,r,s); out=out*(1-m)+(out*np.array(col,np.float32)/255)*m
Image.fromarray(out.clip(0,255).astype(np.uint8)).save('floor_block_B.png')
