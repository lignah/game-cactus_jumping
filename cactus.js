'use strict'

const canvas= document.getElementById('canvas');
const ctx= canvas.getContext('2d');

// logical game resolution; the canvas backing store is scaled to fit the screen and devicePixelRatio
const W= 355
const H= 200
let scale= 1
function resizeCanvas() {
  scale= Math.min((window.innerWidth - 2) / W, (window.innerHeight - 2) / H)
  const dpr= window.devicePixelRatio || 1
  canvas.style.width= `${W * scale}px`
  canvas.style.height= `${H * scale}px`
  canvas.width= Math.round(W * scale * dpr)
  canvas.height= Math.round(H * scale * dpr)
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.imageSmoothingEnabled= false
  positionRestartButton();
}



// image
let human_array= []
for (let i= 1; i<= 6; i++) {
  let human_img= new Image();
  human_img.src= `public/${i}.png`
  human_array.push(human_img);
}
let jumpOnImg= new Image();
let jumpIngImg= new Image();
let jumpDownImg= new Image();
let cactus_img= new Image();
let cactus_img2= new Image();
let star_img= new Image();
jumpOnImg.src= 'public/jump on.png'
jumpIngImg.src= 'public/jump ing.png'
jumpDownImg.src= 'public/jump down.png'
cactus_img.src= 'public/cactus.png'
cactus_img2.src= 'public/cactus2.png'
star_img.src= 'public/star.png'



// game status
let game_state= 'intro'

// score
let current_score= 0
let high_score= Number(localStorage.getItem('high_score')) || 0
let is_new_high= false

// 사운드
const audioCtx= new window.AudioContext();
function resumeAudio() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
function playBeep(frequency, startTime, duration) {
  const oscillator= audioCtx.createOscillator();
  const gainNode= audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.type= 'sine';
  oscillator.frequency.setValueAtTime(frequency, startTime);
  oscillator.start(startTime);
  gainNode.gain.setValueAtTime(1, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.00001, startTime + duration);
  oscillator.stop(startTime + duration);
}
function playJumpSound() {
  playBeep(1440, audioCtx.currentTime, 0.1);
}
function playGameOverSound() {
  playBeep(250, audioCtx.currentTime, 0.05);
  playBeep(250, audioCtx.currentTime + 0.15, 0.05);
}






// Human
class Human {
  constructor() {
    this.x= 10
    this.y= H - 30
    this.width= 30
    this.height= 30
    this.velocity_y= 0
    this.gravity= 0.5
    this.jumping= false
    this.frame= 0
    this.frame_interval= 10
    this.frame_timer= 0
  }

  draw(dt) {
    if (!this.jumping) {
      this.frame_timer+= dt
      if (this.frame_timer>= this.frame_interval) {
        this.frame= (this.frame + 1) % human_array.length
        this.frame_timer= 0
      }
    }
    ctx.drawImage(humanSprite(this), this.x, this.y, this.width, this.height);
  }

  update(dt) {
    if (this.jumping) {
      this.velocity_y += this.gravity * dt
      this.y+= this.velocity_y * dt
      if (this.y + this.height >= H) {
        this.y= H - this.height
        this.jumping= false
        this.velocity_y= 0
      }
    }
  }

  jump() {
    if (!this.jumping) {
      this.jumping= true
      this.velocity_y= -10
      playJumpSound();
    }
  }

  // releasing the jump input early cuts the ascent short for a lower hop
  releaseJump() {
    if (this.jumping && this.velocity_y < MIN_JUMP_VELOCITY) {
      this.velocity_y= MIN_JUMP_VELOCITY
    }
  }
}
// a tap peaks around 39px; holding keeps the full -10 launch and peaks around 95px
const MIN_JUMP_VELOCITY= -6.5
let human = new Human();




// Obstacle
// short cacti are cleared by a tap; tall ones need the held jump
// art is square, so width follows height and the picture is not stretched
const OBSTACLE_KINDS= [
  { img: cactus_img, height: 34 },
  { img: cactus_img2, height: 74 },
]
class Obstacle {
  constructor(kind) {
    this.img= kind.img
    this.height= kind.height
    const aspect= kind.img.naturalWidth > 0 && kind.img.naturalHeight > 0
      ? kind.img.naturalWidth / kind.img.naturalHeight
      : 1
    this.width= Math.round(kind.height * aspect)
    this.x= W
    this.y= H - kind.height + 3
  }

  draw() {
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
  }

  update(dt, speed) {
    this.x -= speed * dt
  }
}




// Star
class Star {
  constructor() {
    this.x= Math.random() * W
    this.y= 0
    this.size= Math.random() * 2 + 1
    this.speed= Math.random() * 0.5 + 0.5
    this.place();
  }

  // keep stars out of the score block and off the ground line
  place() {
    this.y= 8 + Math.random() * (H - 70)
    if (this.x > W - 160 && this.y < 58) {
      this.y= 58 + Math.random() * 50
    }
  }

  draw() {
    ctx.drawImage(star_img, this.x, this.y, this.size * 10, this.size * 10);
  }

  update(dt) {
    this.x -= this.speed * dt
    if (this.x < 0) {
      this.x= W
      this.size= Math.random() * 2 + 1
      this.speed= Math.random() * 0.5 + 0.5
      this.place();
    }
  }
}
let stars= []
const numberOfStars= 3
for (let i = 0; i < numberOfStars; i++) {
  stars.push(new Star());
}




// variable
let gameover= false
let obstacles= []
let obstacles_spawned= 0
let timer= 0
let animation
let last_frame_time= null
const FIRST_SPAWN_TIME= 120
let next_spawn_time= FIRST_SPAWN_TIME
const BASE_SPEED= 4
const MAX_SPEED= 8
const SPEED_PER_SCORE= 0.025
const FRAME_MS= 1000 / 60
const MAX_DT= 3 // clamp so a backgrounded tab doesn't teleport obstacles




// intro
function drawIntro() {
  ctx.fillStyle= 'black'
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle= 'white'
  ctx.textAlign= 'center'
  ctx.font= '28px serif'
  ctx.fillText('cactus jumping', W / 2, 72);
  ctx.font= '16px serif'
  ctx.fillText('tap or space to start', W / 2, 108);
  ctx.fillText('hold to jump higher', W / 2, 132);
}

// score
function drawScore() {
  ctx.font= '15px serif'
  ctx.fillStyle= 'black'
  ctx.textAlign= 'right'
  ctx.fillText(`Score: ${current_score}`, W - 20, 30);
  ctx.fillText(`High Score: ${high_score}`, W - 20, 50);
}

let ground_offset= 0
function drawGround(distance) {
  const dash= 8
  const gap= 6
  const period= dash + gap
  ground_offset= (ground_offset + distance) % period
  ctx.strokeStyle= 'black'
  ctx.lineWidth= 1
  ctx.beginPath();
  const y= H - 0.5
  for (let x= -ground_offset; x < W; x+= period) {
    ctx.moveTo(x, y);
    ctx.lineTo(Math.min(x + dash, W), y);
  }
  ctx.stroke();
}




// difficulty
function getSpeed() {
  return Math.min(BASE_SPEED + current_score * SPEED_PER_SCORE, MAX_SPEED)
}

// Frames between cactus left edges. A full jump is airborne for 39 frames and needs
// about 10 more to jump again. At the speed cap a tall cactus is 74/8 frames wide,
// so anything under 58 frames lands the player on the next cactus.
const MIN_SPAWN_GAP= 58
const TUTORIAL_SPAWN_GAP= 110
function randomSpawnGap() {
  if (obstacles_spawned <= 2) return TUTORIAL_SPAWN_GAP
  const base= Math.max(MIN_SPAWN_GAP, 120 - current_score * 0.4)
  return base + Math.random() * base * 0.2
}

function nextObstacleKind() {
  if (obstacles_spawned === 0) return OBSTACLE_KINDS[0]
  if (obstacles_spawned === 1) return OBSTACLE_KINDS[1]
  const tallChance= Math.min(0.6, 0.3 + Math.max(0, current_score - 40) * 0.002)
  return OBSTACLE_KINDS[Math.random() < tallChance ? 1 : 0]
}




// game loop
function frame60(timestamp) {
  // dt is measured in 60fps frames so the game runs at the same speed on any refresh rate
  const dt= last_frame_time === null ? 1 : Math.min((timestamp - last_frame_time) / FRAME_MS, MAX_DT)
  last_frame_time= timestamp

  ctx.clearRect(0, 0, W, H);

  if (game_state === 'intro') {
    drawIntro();
  } else if (game_state === 'playing') {
    timer+= dt;
    current_score= Math.floor(timer / 10);

    stars.forEach(e=> {
      e.update(dt);
      e.draw();
    });

    const speed= getSpeed();
    drawGround(speed * dt);

    human.update(dt);
    human.draw(dt);

    // first cactus is short, the second is tall, then tall ones become more common
    if (timer >= next_spawn_time) {
      const kind= nextObstacleKind()
      obstacles_spawned++
      obstacles.push(new Obstacle(kind));
      next_spawn_time= timer + randomSpawnGap();
    }
    obstacles.forEach(obstacle=> {
      obstacle.update(dt, speed);
      obstacle.draw();
      collision_detection(human, obstacle);
    });
    obstacles= obstacles.filter(obstacle=> obstacle.x + obstacle.width >= 0);

    drawScore();

    if (gameover) {
      ctx.fillStyle = 'rgba(128, 128, 128, 0.5)' // translucent gray
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle= 'rgba(255, 255, 255, 0.92)'
      ctx.fillRect(W / 2 - 120, 68, 240, 64);
      ctx.font= '32px serif'
      ctx.fillStyle= 'black'
      ctx.textAlign= 'center'
      ctx.fillText('game over', W / 2, 96);
      if (is_new_high) {
        ctx.font= '18px serif'
        ctx.fillText('New High Score!', W / 2, 122);
      }
      create_restartbutton();
    }
  }

  if (!gameover) {
    animation= requestAnimationFrame(frame60);
  }
}
animation= requestAnimationFrame(frame60);




function humanSprite(human) {
  if (!human.jumping) return human_array[human.frame]
  if (human.velocity_y < 0) return jumpOnImg
  if (human.y < H - 120) return jumpIngImg
  return jumpDownImg
}

// opaque spans per image row, so the empty corners of a cactus are not solid
function spriteMask(img) {
  if (img._mask) return img._mask
  if (!img.complete || img.naturalWidth === 0) return null
  const w= img.naturalWidth
  const h= img.naturalHeight
  const scratch= document.createElement('canvas')
  scratch.width= w
  scratch.height= h
  const g= scratch.getContext('2d', { willReadFrequently: true })
  g.drawImage(img, 0, 0)
  const data= g.getImageData(0, 0, w, h).data
  const rows= new Array(h)
  for (let y= 0; y < h; y++) {
    const spans= []
    let start= -1
    for (let x= 0; x < w; x++) {
      const solid= data[(y * w + x) * 4 + 3] > 128
      if (solid && start < 0) start= x
      if (!solid && start >= 0) {
        spans.push([start, x])
        start= -1
      }
    }
    if (start >= 0) spans.push([start, w])
    rows[y]= spans
  }
  img._mask= { w, h, rows }
  return img._mask
}

function rowHits(hSpans, hx, hw, hsw, cSpans, cx, cw, csw) {
  for (let i= 0; i < hSpans.length; i++) {
    const a0= hx + hSpans[i][0] / hsw * hw
    const a1= hx + hSpans[i][1] / hsw * hw
    for (let j= 0; j < cSpans.length; j++) {
      const b0= cx + cSpans[j][0] / csw * cw
      const b1= cx + cSpans[j][1] / csw * cw
      if (a1 > b0 && a0 < b1) return true
    }
  }
  return false
}

function spritesTouch(aImg, ax, ay, aw, ah, bImg, bx, by, bw, bh) {
  const a= spriteMask(aImg)
  const b= spriteMask(bImg)
  if (!a || !b) return false
  const top= Math.max(ay, by)
  const bot= Math.min(ay + ah, by + bh)
  if (top >= bot) return false
  const left= Math.max(ax, bx)
  const right= Math.min(ax + aw, bx + bw)
  if (left >= right) return false
  for (let y= Math.floor(top); y < Math.ceil(bot); y++) {
    const ayRow= Math.min(a.h - 1, Math.max(0, Math.floor((y - ay) / ah * a.h)))
    const byRow= Math.min(b.h - 1, Math.max(0, Math.floor((y - by) / bh * b.h)))
    if (rowHits(a.rows[ayRow], ax, aw, a.w, b.rows[byRow], bx, bw, b.w)) return true
  }
  return false
}

// collision
function collision_detection(human, cactus) {
  if (gameover) return
  if (!spritesTouch(humanSprite(human), human.x, human.y, human.width, human.height, cactus.img, cactus.x, cactus.y, cactus.width, cactus.height)) return

  gameover= true
  cancelAnimationFrame(animation);
  playGameOverSound();

  if (current_score > high_score) {
    is_new_high= true
    high_score= current_score
    localStorage.setItem('high_score', high_score);
  }
}




// restart button
let restart_button= null
function create_restartbutton() {
  if (restart_button) return
  restart_button= document.createElement('img');
  restart_button.src= `public/restart.png`
  restart_button.alt= 'restart'
  document.body.appendChild(restart_button);
  positionRestartButton();

  restart_button.addEventListener('click', $=> {
    restartGame();
  });
}

function positionRestartButton() {
  if (!restart_button) return
  restart_button.style.position= 'absolute'
  restart_button.style.left= `${canvas.offsetLeft + (W * scale) / 2}px`
  restart_button.style.top= `${canvas.offsetTop + 136 * scale}px`
  restart_button.style.transform= 'translateX(-50%)'
  restart_button.style.width= `${100 * scale}px`
}

function removeRestartButton() {
  if (!restart_button) return
  restart_button.remove();
  restart_button= null
}

function restartGame() {
  if (!gameover) return
  cancelAnimationFrame(animation);
  removeRestartButton();
  gameover= false
  is_new_high= false
  game_state= 'playing'
  human= new Human();
  obstacles= []
  obstacles_spawned= 0
  ground_offset= 0
  timer= 0
  current_score= 0
  next_spawn_time= FIRST_SPAWN_TIME
  last_frame_time= null
  animation= requestAnimationFrame(frame60);
}




// jump and start
document.addEventListener('keydown', e=> {
  if (e.code === 'Space') {
    e.preventDefault();
    resumeAudio();
    if (game_state === 'intro') {
      game_state= 'playing'
    } else if (gameover) {
      restartGame();
    } else {
      human.jump();
    }
  }
});

document.addEventListener('keyup', e=> {
  if (e.code === 'Space') {
    human.releaseJump();
  }
});

// double click
canvas.addEventListener('dblclick', e=> {
  e.preventDefault();
});

// dont move
window.addEventListener('touchmove', e=> {
  e.preventDefault();
}, { passive: false });

// jump
document.addEventListener('selectstart', e=> {
  e.preventDefault();
});

document.addEventListener('contextmenu', e=> {
  e.preventDefault();
});

document.addEventListener('touchstart', e=> {
  e.preventDefault();
  resumeAudio();
  if (game_state === 'intro') {
    game_state= 'playing'
  } else if (gameover) {
    restartGame();
  } else {
    human.jump();
  }
}, { passive: false });

document.addEventListener('touchend', $=> {
  human.releaseJump();
});

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
