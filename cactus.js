'use strict'

const canvas= document.getElementById('canvas');
const ctx= canvas.getContext('2d');
canvas.width= 355
canvas.height= 200



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
    this.y= canvas.height - 30
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
      } else if (this.velocity_y >= 0 && this.y < canvas.height - 120) {
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
      if (this.y + this.height >= canvas.height) {
        this.y= canvas.height - this.height
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
}
let human = new Human();




// Obstacle
const cactus_images= [cactus_img, cactus_img2]
class Obstacle {
  constructor(img) {
    this.img= img
    this.x= canvas.width
    this.y= canvas.height - 42
    this.width= 30
    this.height= 45
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
    this.x= Math.random() * canvas.width
    this.y= Math.random() * canvas.height
    this.size= Math.random() * 2 + 1
    this.speed= Math.random() * 0.5 + 0.5
  }

  draw() {
    ctx.drawImage(star_img, this.x, this.y, this.size * 10, this.size * 10);
  }

  update(dt) {
    this.x -= this.speed * dt
    if (this.x < 0) {
      this.x= canvas.width
      this.y= Math.random() * canvas.height
      this.size= Math.random() * 2 + 1
      this.speed= Math.random() * 0.5 + 0.5
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
let timer= 0
let animation
let last_frame_time= null
const FIRST_SPAWN_TIME= 120
let next_spawn_time= FIRST_SPAWN_TIME
const BASE_SPEED= 4
const FRAME_MS= 1000 / 60
const MAX_DT= 3 // clamp so a backgrounded tab doesn't teleport obstacles




// intro
function drawIntro() {
  ctx.fillStyle= 'black'
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font= '28px serif'
  ctx.fillStyle= 'white'
  ctx.textAlign= 'center'
  ctx.fillText('cactus jumping', canvas.width / 2, canvas.height / 3);
  ctx.font= '20px serif'
  ctx.fillText('space to start', canvas.width / 2, canvas.height / 2);
}

// score
function drawScore() {
  ctx.font= '15px serif'
  ctx.fillStyle= 'black'
  ctx.textAlign= 'right'
  ctx.fillText(`Score: ${current_score}`, canvas.width - 20, 30);
  ctx.fillText(`High Score: ${high_score}`, canvas.width - 20, 50);
}




// difficulty
function getSpeed() {
  return BASE_SPEED
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

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (game_state === 'intro') {
    drawIntro();
  } else if (game_state === 'playing') {
    timer+= dt;
    current_score= Math.floor(timer / 10);

    stars.forEach(e=> {
      e.update(dt);
      e.draw();
    });

    human.update(dt);
    human.draw(dt);

    drawScore();




    // obstacle gen
    const speed= getSpeed();
    if (timer >= next_spawn_time) {
      const img= cactus_images[Math.floor(Math.random() * cactus_images.length)]
      obstacles.push(new Obstacle(img));
      next_spawn_time= timer + randomSpawnGap(speed);
    }
    obstacles.forEach(obstacle=> {
      obstacle.update(dt, speed);
      obstacle.draw();
      collision_detection(human, obstacle);
    });
    obstacles= obstacles.filter(obstacle=> obstacle.x + obstacle.width >= 0);

    if (gameover) {
      ctx.fillStyle = 'rgba(128, 128, 128, 0.5)' // translucent gray
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font= '32px serif'
      ctx.fillStyle= 'black'
      ctx.textAlign= 'center'
      ctx.fillText('game over', canvas.width / 2, canvas.height / 2 - 24);
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

  const h_left= human.x
  const h_right= human.x + human.width
  const h_top= human.y
  const h_bot= human.y + human.height
  const c_left= cactus.x
  const c_right= cactus.x + cactus.width
  const c_top= cactus.y
  const c_bot= cactus.y + cactus.height

  if (h_right > c_left && h_left < c_right && h_bot > c_top && h_top < c_bot) {
    gameover= true
    cancelAnimationFrame(animation);
    playGameOverSound();

    // update high score
    if (current_score > high_score) {
      high_score= current_score
      localStorage.setItem('high_score', high_score);
    }
  }
}




// restart button
function create_restartbutton() {
  let button= document.createElement('img');
  button.src= `public/restart.png`
  button.style.position = 'absolute'
  button.style.left= `${canvas.offsetLeft + canvas.width / 2}px`
  button.style.top= `${canvas.offsetTop + canvas.height / 2}px`
  button.style.transform= 'translateX(-50%)'
  button.style.width= '100px'
  document.body.appendChild(button);

  button.addEventListener('click', $=> {
    document.body.removeChild(button);
    restartGame();
  });
}

function restartGame() {
  gameover= false
  game_state= 'playing'
  human= new Human();
  obstacles= []
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
    } else if (!gameover) {
      human.jump();
    }
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
document.addEventListener('touchstart', $=> {
  resumeAudio();
  if (game_state === 'intro') {
    game_state= 'playing'
  } else if (!gameover) {
    human.jump();
  }
});
