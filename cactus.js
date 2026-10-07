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
    let human_img
    if (this.jumping) {
      if (this.velocity_y < 0) {
        human_img= jumpOnImg
      } else if (this.velocity_y >= 0 && this.y < H - 120) {
        human_img= jumpIngImg
      } else {
        human_img= jumpDownImg
      }
    } else {
      this.frame_timer+= dt
      if (this.frame_timer>= this.frame_interval) {
        this.frame= (this.frame + 1) % human_array.length
        this.frame_timer= 0
      }
      human_img= human_array[this.frame]
    }
    ctx.drawImage(human_img, this.x, this.y, this.width, this.height);
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
// pads are the transparent margins of each file, as a fraction of that square
const OBSTACLE_KINDS= [
  { img: cactus_img, height: 34, padX: 0.25, padTop: 0.02, tall: false },
  { img: cactus_img2, height: 74, padX: 0.21, padTop: 0.15, tall: true },
]
class Obstacle {
  constructor(kind) {
    this.img= kind.img
    this.tall= kind.tall
    this.height= kind.height
    const aspect= kind.img.naturalWidth > 0 && kind.img.naturalHeight > 0
      ? kind.img.naturalWidth / kind.img.naturalHeight
      : 1
    this.width= Math.round(kind.height * aspect)
    this.padX= Math.round(this.width * kind.padX)
    this.padTop= Math.round(this.height * kind.padTop)
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
const MAX_SPEED= 9
const SPEED_PER_SCORE= 0.005
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

// Gap in frames until the next spawn. A full jump takes 40 frames in the air, so the
// minimum gap must leave room to land, react and jump again at the current speed.
function randomSpawnGap(speed) {
  const min_gap= Math.max(65, 130 - (speed - BASE_SPEED) * 12)
  return min_gap + Math.random() * min_gap
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

    // first cactus is short, the second is tall, then the mix is random
    if (timer >= next_spawn_time) {
      const kind= obstacles_spawned < 2
        ? OBSTACLE_KINDS[obstacles_spawned]
        : OBSTACLE_KINDS[Math.floor(Math.random() * OBSTACLE_KINDS.length)]
      obstacles_spawned++
      obstacles.push(new Obstacle(kind));
      next_spawn_time= timer + randomSpawnGap(speed);
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




// collision
function collision_detection(human, cactus) {
  if (gameover) return

  // hitboxes are inset from the sprites so near misses on transparent edges don't count
  const h_left= human.x + 6
  const h_right= human.x + human.width - 6
  const h_top= human.y + 4
  const h_bot= human.y + human.height
  const c_left= cactus.x + cactus.padX
  const c_right= cactus.x + cactus.width - cactus.padX
  const c_top= cactus.y + cactus.padTop
  const c_bot= cactus.y + cactus.height

  if (h_right > c_left && h_left < c_right && h_bot > c_top && h_top < c_bot) {
    gameover= true
    cancelAnimationFrame(animation);
    playGameOverSound();

    // update high score
    if (current_score > high_score) {
      is_new_high= true
      high_score= current_score
      localStorage.setItem('high_score', high_score);
    }
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
