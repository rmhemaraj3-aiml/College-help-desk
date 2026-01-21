(() => {
    const M = Math, D = document, c = D.getElementById('c'), x = c.getContext('2d');
    if (!c) { console.error("Canvas element #c not found"); return; }
    let W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio;
    c.style.width = `${innerWidth}px`; c.style.height = `${innerHeight}px`;
    x.scale(devicePixelRatio, devicePixelRatio);

    let particles = [], isPaused = false;
    let stars = [];

    const createStars = () => {
        stars = [];
        const starCount = M.floor((innerWidth * innerHeight) / 5000);
        for (let i = 0; i < starCount; i++) {
            stars.push({
                x: M.random() * innerWidth, y: M.random() * innerHeight,
                r: M.random() * 0.8 + 0.2, alpha: M.random() * 0.5 + 0.2
            });
        }
    };
    
    const P = { count: 400, showTrails: false, centerF: 0.005, drawLines: false, lineThreshold: 0.85, sizeVariation: 0.47, minOpacity: 0.89, enableGlow: true, glowIntensity: 28, minDrag: 0.4, maxDrag: 0.95, maxAccel: 1.1, enableCollisions: true, interiorFluid: 0.17, phaseResponse: 0.37, densityResponse: 26, phaseSync: 0.087, minDist: 46, bondDist: 142, bondStrength: 0.1, maxNetworkSize: 36, networkRepelStrength: 0.29, modulus: 432, coherenceThreshold: 0.94, coherenceForce: 0.87, coherenceFn: 'normalized-difference', surfaceThreshold: 1 };
    let avgKE = 0, currentDrag = 0, coherenceMatrix = [], primeNumbers = [];

    const isPrime = num => { if (num <= 1) return false; for (let i = 2, s = M.sqrt(num); i <= s; i++) if (num % i === 0) return false; return true; };
    const generatePrimes = count => { primeNumbers = []; let num = 2; while (primeNumbers.length < count) { if (isPrime(num)) primeNumbers.push(num); num++; } };
    const calculateRelationship = (p, q, fn) => { switch(fn) { case 'modular-residue': return (p % q) / q; case 'logarithmic-resonance': return M.abs(M.cos(2*M.PI*M.log10(q)/M.log10(p))); case 'log-ratio': return 1 - (M.abs(M.log(p)-M.log(q))/M.log(p+q)); default: return 1 - (M.abs(p-q)/(p+q)); }};
    const calculateSymbolicFingerprint = (prime, allPrimes, fn) => { const fp = []; for (const o of allPrimes) { if (o !== prime) fp.push(calculateRelationship(prime, o, fn)); else fp.push(1); } return fp; };
    const calculateFingerprintCoherence = (fp1, fp2) => { let dot = 0, m1 = 0, m2 = 0; for (let i=0; i<fp1.length; i++) { dot += fp1[i]*fp2[i]; m1 += fp1[i]*fp1[i]; m2 += fp2[i]*fp2[i]; } m1=M.sqrt(m1); m2=M.sqrt(m2); if (m1===0 || m2===0) return 0; return M.max(0, dot / (m1*m2)); };
    const calculateSurfaceMetric = (p, neighbors) => { if (neighbors.length === 0) { p.normalX=0; p.normalY=0; return 0; } let sumX=0, sumY=0; for (const n of neighbors) { const dX=n.x-p.x, dY=n.y-p.y, dist=M.hypot(dX, dY); if (dist>0) { sumX+=dX/dist; sumY+=dY/dist; } } const mag=M.hypot(sumX, sumY); if (mag>0) { p.normalX=sumX/mag; p.normalY=sumY/mag; } return mag/neighbors.length; };
    
    class Particle {
        constructor(i, primeValue) {
            this.id = i; this.P = P; this.value = primeValue; this.residue = this.value % this.P.modulus;
            this.color = `hsl(${(this.residue / this.P.modulus) * 360}, 100%, 75%)`;
            this.x = innerWidth/2 + (M.random()-0.5)*innerWidth*0.8; this.y = innerHeight/2 + (M.random()-0.5)*innerHeight*0.8;
            this.vx = M.random()*2-1; this.vy = M.random()*2-1; this.baseSize = 2 + M.random(); this.phase = M.random() * 360;
            this.ax=0; this.ay=0; this.density=0; this.phaseInfluence=0; this.influenceCount=0; this.isLocked=false; this.isSurface=false;
            this.neighbors=[]; this.prevX=this.x; this.prevY=this.y; this.fingerprint=[]; this.coherentLinks=0;
        }
        update() {
            const targetPhase = this.isLocked ? 90 : 180 + this.density * P.densityResponse;
            this.phase += (targetPhase - this.phase) * 0.01;
            if (this.influenceCount > 0) this.phase += (this.phaseInfluence / this.influenceCount) * P.phaseSync;
            this.phase = (this.phase % 360 + 360) % 360;
            if (avgKE < 0.8) this.isLocked = true; else if (avgKE > 1.2) this.isLocked = false;
            const totalAccel = M.hypot(this.ax, this.ay);
            if (totalAccel > P.maxAccel) { const s = P.maxAccel / totalAccel; this.ax *= s; this.ay *= s; }
            const effectiveDrag = this.isSurface ? currentDrag : currentDrag * P.interiorFluid;
            this.vx = (this.vx + this.ax) * (1 - effectiveDrag); this.vy = (this.vy + this.ay) * (1 - effectiveDrag);
            this.x += this.vx; this.y += this.vy;
            const dC = M.hypot(innerWidth/2-this.x, innerHeight/2-this.y);
            if (dC > 0) { this.ax += (innerWidth/2-this.x)/dC * P.centerF; this.ay += (innerHeight/2-this.y)/dC * P.centerF; }
            if (this.x<0||this.x>innerWidth) { this.vx*=-1; this.x=M.max(0, M.min(innerWidth,this.x)); }
            if (this.y<0||this.y>innerHeight) { this.vy*=-1; this.y=M.max(0, M.min(innerHeight,this.y)); }
        }
        draw() {
            let opacity = 1;
            const sS = this.vx*this.vx + this.vy*this.vy; const eR = M.min(1, sS/10); opacity = P.minOpacity + (1-eR)*(1-P.minOpacity);
            const dS = this.baseSize + (this.coherentLinks * P.sizeVariation);
            if (dS <= 0.1) return;
            if (P.enableGlow) { const gR = dS * (1.2 + P.glowIntensity / 50); const gO = this.isLocked ? 0.25 : 0.15; x.fillStyle = this.color.replace(')', `, ${gO * 0.5})`).replace('hsl', 'hsla'); x.beginPath(); x.arc(this.x, this.y, gR, 0, M.PI * 2); x.fill(); }
            x.fillStyle = this.isLocked ? `hsl(${(this.residue / P.modulus) * 360}, 100%, 75%, 0.8)` : this.color.replace('75%)', `85%, ${opacity})`).replace('hsl', 'hsla');
            x.beginPath(); x.arc(this.x, this.y, dS, 0, M.PI * 2); x.fill();
        }
    }

    function resolveCollisions() {
        if (!P.enableCollisions) return;
        for (let k = 0; k < 2; k++) {
            for (const p1 of particles) {
                for (const p2 of p1.neighbors) {
                    if (p1.id >= p2.id) continue;
                    const dX = p1.x-p2.x, dY = p1.y-p2.y; const dS = dX*dX+dY*dY; const minCD = p1.baseSize+p2.baseSize;
                    if (dS > 0 && dS < minCD*minCD) {
                        const dist=M.sqrt(dS);
                        if (k===0) {
                            const nx=dX/dist, ny=dY/dist; const rVx=p1.vx-p2.vx, rVy=p1.vy-p2.vy; const speed=rVx*nx+rVy*ny;
                            if(speed<0){p1.vx-=speed*nx;p1.vy-=speed*ny;p2.vx+=speed*nx;p2.vy+=speed*ny;}
                        }
                        const overlap=minCD-dist, pF=0.5/2; const pX=(dX/dist)*overlap*pF, pY=(dY/dist)*overlap*pF;
                        p1.x+=pX; p1.y+=pY; p2.x-=pX; p2.y-=pY;
                    }
                }
            }
        }
    }

    function init() {
        createStars();
        generatePrimes(P.count);
        particles = Array.from({ length: P.count }, (_, i) => new Particle(i, primeNumbers[i]));
        const allPV = particles.map(p => p.value);
        particles.forEach(p => { p.fingerprint = calculateSymbolicFingerprint(p.value, allPV, P.coherenceFn); });
        const count = P.count; coherenceMatrix = Array(count).fill(0).map(() => Array(count).fill(0));
        for (let i = 0; i < count; i++) { for (let j = i + 1; j < count; j++) { const s = calculateFingerprintCoherence(particles[i].fingerprint, particles[j].fingerprint); coherenceMatrix[i][j] = s; coherenceMatrix[j][i] = s; } }
    }

    function animate(t) {
        if (isPaused) return;
        requestAnimationFrame(animate);
        
        // THIS IS THE CORRECTED LINE
        x.fillStyle = P.showTrails ? 'rgba(1, 4, 10, 0.1)' : '#33333329';
        x.fillRect(0, 0, innerWidth, innerHeight);

        const cX = innerWidth/2, cY = innerHeight/2;
        x.save(); 
        x.translate(cX, cY); 
        x.rotate(t * 0.00002);
        x.translate(-cX, -cY);
        stars.forEach(s => { 
            x.beginPath(); 
            x.arc(s.x, s.y, s.r, 0, 2*M.PI); 
            x.fillStyle=`rgba(255,255,240,${s.alpha})`; 
            x.fill(); 
        });
        x.restore();

        if (!particles.length) return;
        let totalKE=0;
        particles.forEach(p=>{p.ax=0; p.ay=0; p.density=0; p.phaseInfluence=0; p.influenceCount=0; p.coherentLinks=0; p.network=null; p.networkSize=0; totalKE += 0.5*(p.vx*p.vx+p.vy*p.vy);});
        avgKE = totalKE / P.count;
        currentDrag = P.maxDrag - M.max(0, M.min(1, (avgKE - 0.5) / 5)) * (P.maxDrag - P.minDrag);
        const grid=new Map(), cS=M.max(P.bondDist,P.minDist)*1.5; for(const p of particles){const k=`${M.floor(p.x/cS)},${M.floor(p.y/cS)}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(p);}
        for(const p1 of particles){p1.neighbors=[];const gX=M.floor(p1.x/cS),gY=M.floor(p1.y/cS);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const cell=grid.get(`${gX+dx},${gY+dy}`);if(!cell)continue;for(const p2 of cell){if(p1.id===p2.id)continue;if((p1.x-p2.x)**2+(p1.y-p2.y)**2<cS**2)p1.neighbors.push(p2);}}}
        particles.forEach(p1 => { p1.isSurface = calculateSurfaceMetric(p1,p1.neighbors) > P.surfaceThreshold && p1.isLocked; });
        
        for (const p1 of particles) {
            for (const p2 of p1.neighbors) {
                if (p1.id >= p2.id) continue;
                const dX=p1.x-p2.x, dY=p1.y-p2.y, dS=dX*dX+dY*dY; if(dS===0) continue;
                const dist=M.sqrt(dS);
                if(dist < P.minDist * 1.5){ p1.density+=1-dist/(P.minDist*1.5); p2.density+=1-dist/(P.minDist*1.5); }
                if (dist < P.bondDist) { let pD=p2.phase-p1.phase; pD-=M.round(pD/360)*360; p1.phaseInfluence+=pD; p2.phaseInfluence-=pD; p1.influenceCount++; p2.influenceCount++; }
                const cohS=coherenceMatrix[p1.id][p2.id];
                if (cohS>P.coherenceThreshold){ const fM=(cohS-P.coherenceThreshold)/(1-P.coherenceThreshold), f=fM*P.coherenceForce*-1; const p1AMod=1-P.phaseResponse+P.phaseResponse*(2-p1.phase/180); p1.ax+=dX/dist*f*p1AMod; p1.ay+=dY/dist*f*p1AMod; const p2AMod=1-P.phaseResponse+P.phaseResponse*(2-p2.phase/180); p2.ax-=dX/dist*f*p2AMod; p2.ay-=dY/dist*f*p2AMod; }
                if (dist < P.minDist){ const f=(1-dist/P.minDist)*0.5; const p1RMod=1-P.phaseResponse+P.phaseResponse*(p1.phase/180); p1.ax+=dX/dist*f*p1RMod; p1.ay+=dY/dist*f*p1RMod; const p2RMod=1-P.phaseResponse+P.phaseResponse*(p2.phase/180); p2.ax-=dX/dist*f*p2RMod; p2.ay-=dY/dist*f*p2RMod; }
            }
        }
        particles.forEach(p => p.update());
        resolveCollisions();
        particles.forEach(p => p.draw());
    }

    const pushStrength=1.5, pushRadius=80;
    const handleTouches = e => { e.preventDefault(); if (particles.length === 0) return; const rect = c.getBoundingClientRect(); for (const touch of e.touches) { const tX=touch.clientX-rect.left, tY=touch.clientY-rect.top; for (const p of particles) { const dx=p.x-tX, dy=p.y-tY, dS=dx*dx+dy*dy; if (dS<pushRadius*pushRadius && dS>0){ const dist=M.sqrt(dS), force=(1-dist/pushRadius)*pushStrength; p.ax+=(dx/dist)*force; p.ay+=(dy/dist)*force; } } } };
    c.addEventListener('touchstart', handleTouches, { passive: false });
    c.addEventListener('touchmove', handleTouches, { passive: false });
    
    window.onresize = () => {
        W = c.width = innerWidth * devicePixelRatio; H = c.height = innerHeight * devicePixelRatio;
        c.style.width = `${innerWidth}px`; c.style.height = `${innerHeight}px`;
        x.scale(devicePixelRatio, devicePixelRatio);
        createStars();
    };

    init(); 
    requestAnimationFrame(animate);
})();