"""locate.py: where a piece of interface art sits in a reference frame, by masked correlation then a fine search."""
import glob
import numpy as np
from PIL import Image
FR=sorted(glob.glob('/tmp/claude-501/ref/data/tsuki/frames/*.ppm'))
def frame(i):
    return np.asarray(Image.open(FR[i]).convert('RGB').transpose(Image.FLIP_TOP_BOTTOM),np.float32)
def tex(pack,name,rect=None):
    im=Image.open(f'web/assets/ui/{pack}/{name}.webp').convert('RGBA')
    if rect: im=im.crop(rect)
    return np.asarray(im,np.float32)
def locate(F,T,top=1):
    g=F.mean(2);t=T[...,:3].mean(2);a=T[...,3]/255
    H,W=g.shape;h,w=t.shape
    tm=(t-(t*a).sum()/max(a.sum(),1))*a
    gf=np.fft.rfft2(g-g.mean());tf=np.fft.rfft2(tm,s=g.shape)
    c=np.fft.irfft2(gf*np.conj(tf),s=g.shape)
    c=c[:max(1,H-h+1),:max(1,W-w+1)] if h<=H and w<=W else c
    idx=np.argsort(c.ravel())[::-1][:400];best=(1e18,0,0)
    tried=set()
    for k in idx:
        y,x=np.unravel_index(k,c.shape)
        if (x//4,y//4) in tried: continue
        tried.add((x//4,y//4))
        if len(tried)>12: break
        for dy in range(-2,3):
            for dx in range(-2,3):
                X,Y=x+dx,y+dy
                if X<0 or Y<0 or X+w>W or Y+h>H: continue
                r=g[Y:Y+h,X:X+w]
                # gain/offset free fit in the mask
                A=(a*t).sum()/a.sum();B=(a*r).sum()/a.sum()
                e=(a*((r-B)-(t-A))**2).sum()/a.sum()
                if e<best[0]: best=(float(e),int(X),int(Y))
    return best
