"use strict";

var canvas = document.getElementById("flappyCanvas");
var ctx = canvas.getContext("2d");

var started = false;
var gameCounter = 0;

// Bird data
var bx = canvas.width / 2;
var by = canvas.height / 2;
var mom = 0;
var birdSize = 10;
var score = 0;

// Pipe data
var pipes = [];
var pipeDelayStart = 1.7 * 100;
var pipeDelay = 0;
var pipeWidth = 30;
var pipeColor = "#3CC128";
var gapSizeDef = 150;
var gapStartPoint = 200;
var highScore = 0;
// Reinforcement Learning variables
var env, lv_state = [], lv_action, lv_reward, lv_score = 0, lv_init = 'X', Q_table = {};
var f = 0;
var speed = 0.01; //to change the speed of the game

draw();
setInterval(mainLoop, speed);

// Input handler
function inputHandler() {
    if (started) {
        mom = Math.min(mom + 3, 20);
    } else {
        bx = canvas.width / 2;
        by = canvas.height / 2;
        mom = 0;
        pipes = [];
        score = 0;
        started = true;
    }
}

var gameCounter = 0;
var pointsEarned = [];

function updateGameCounter() {
    document.getElementById("gamesPlayed").textContent = gameCounter;
}

function updatePointCounter() {
    document.getElementById("pointsEarned").textContent = pointsEarned.join(", ");
}


// Main game loop
function mainLoop() {
    if (started) {
        proc();
        draw();
        if (f > 20) {
            f = 0;
            play();
        } else {
            f++;
        }
    } else {
        if (lv_init == 'X') {
            inputHandler();
        } else {
            play();
        }
    }
}

// Update game state
function proc() {
    movePipes();
    by -= mom;
    mom = Math.max(-15, mom - 0.100);
    checkColl();
    checkPipes();
    if (pipes.length >= 1 && pipes[0].x <= 0 && !pipes[0].scored) {
        pipes[0].scored = true;
        scorePoint(); // Call scorePoint when a point is earned
    }
}


// Move pipes
function movePipes() {
    pipes.forEach(function (pipe) {
        pipe.x--;
        if (!pipe.scored && pipe.x < bx) {
            score++; // increment score here
            pipe.scored = true;
            scorePoint();
        }
    });
}
// Check collision
function checkColl() {
    if (by - birdSize < 0 || by + birdSize > canvas.height) {
        fail();
    }
    pipes.forEach(function (pipe) {
        if (pointRectDist(bx, by, pipe.x - pipe.width, 0, pipe.width, pipe.gapStart) < birdSize - 2 ||
            pointRectDist(bx, by, pipe.x - pipe.width, pipe.gapStart + pipe.gapSize, pipe.width, canvas.height - (pipe.gapStart + pipe.gapSize)) < birdSize - 2) {
            fail();
        }
    });
}

// Check pipes
function checkPipes() {
    pipeDelay = Math.max(pipeDelay - 1, 0);
    if (pipes.length < 3 && pipeDelay === 0) {
        pipeDelay = pipeDelayStart;
        pipes.push({
            x: canvas.width + pipeWidth,
            width: pipeWidth,
            gapStart: 200,
            gapSize: 150,
            scored: false
        });
    }
    if (pipes.length >= 1 && pipes[0].x <= 0) {
        pipes.shift();
    }
}

// Game over
function fail() {
    started = false;
}

// Draw everything
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPipes();
    drawBird();
    drawScore();
}

// Draw pipes
function drawPipes() {
    pipes.forEach(function (pipe) {
        ctx.beginPath();
        ctx.rect(pipe.x, 0, -pipe.width, pipe.gapStart);
        ctx.fillStyle = pipeColor;
        ctx.fill();
        ctx.closePath();

        ctx.beginPath();
        ctx.rect(pipe.x, pipe.gapStart + pipe.gapSize, -pipe.width, canvas.height - (pipe.gapStart + pipe.gapSize));
        ctx.fillStyle = pipeColor;
        ctx.fill();
        ctx.closePath();
    });
}

// Draw bird
function drawBird() {
    ctx.beginPath();
    ctx.arc(bx, by, birdSize, 0, Math.PI * 2);
    ctx.fillStyle = "#FF0202"; 
    ctx.fill();
    ctx.closePath();
}

// Draw score
function drawScore() {
    ctx.fillStyle = "#000000";
    ctx.font = "32px serif";
    ctx.textAlign = "center";
    ctx.fillText(score, canvas.width / 2, 50);
    if (!started) {
        ctx.font = "25px serif";
        ctx.fillText("You lost.", canvas.width / 2, canvas.height / 2 - 50);
        ctx.fillText("Press any key to try again.", canvas.width / 2, canvas.height / 2);
    }
}

// Function to update the high score
// Function to update the high score
function updateHighScore() {
    if (score > highScore) {
        highScore = score;
    }
    document.getElementById("highScoreValue").textContent = highScore; // Update the high score value
}


// Function to reset the high score
function resetHighScore() {
    highScore = 0;
    updateHighScore();
}

// Game over
function fail() {
    started = false;
    updateHighScore(); // Update high score when game ends
}

// Utility function to calculate distance between a point and a rectangle
function pointRectDist(px, py, rx, ry, rwidth, rheight) {
    var cx = Math.max(Math.min(px, rx + rwidth), rx);
    var cy = Math.max(Math.min(py, ry + rheight), ry);
    return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
}

// Flappy Bird class for reinforcement learning
var FlappyBird = function () {
    this.reset();
}
FlappyBird.prototype = {
    reset: function () {
        this.fpbrelx = canvas.width + pipeWidth - bx;
        this.fpbrely = gapStartPoint + gapSizeDef - by;
        this.fpbdora = false;
        this.gamma = 0.8;
        this.alpha = 0.1;
        this.actionSet = {
            STAY: '0',
            JUMP: '1'
        };
        this.s = [];
    },
    getState: function () {
        if (pipes.length > 0) {
            if (bx <= pipes[0].x) {
                this.fpbrelx = parseFloat(parseFloat(pipes[0].x - bx).toFixed(0));
            } else {
                this.fpbrelx = parseFloat(parseFloat(pipes[1].x - bx).toFixed(0));
            }
        }
        if (pipes.length > 0) {
            if (bx <= pipes[0].x) {
                this.fpbrely = parseFloat(parseFloat(pipes[0].gapStart + pipes[0].gapSize / 2 - by).toFixed(0));
            } else {
                this.fpbrely = parseFloat(parseFloat(pipes[1].gapStart + pipes[1].gapSize / 2 - by).toFixed(0));
            }
        }
        this.s = [this.fpbrelx, this.fpbrely, parseFloat(parseFloat(mom).toFixed(1))];
        return this.s;
    },
    implementAction: function (a) {
        if (a == 1) {
            inputHandler();
        }
    },
    getQ: function (s, a) {
        var config = [s[0], s[1], s[2], a];
        if (!(config in Q_table)) {
            return 0;
        }
        return Q_table[config];
    },
    setQ: function (s, a, r) {
        var config = [s[0], s[1], s[2], a];
        if (!(config in Q_table)) {
            Q_table[config] = 0;
        }
        Q_table[config] += r;
    },
    getAction: function (state) {
        var rewardForStay = this.getQ(state, this.actionSet.STAY);
        var rewardForJump = this.getQ(state, this.actionSet.JUMP);
        if (rewardForStay > rewardForJump) {
            return this.actionSet.STAY;
        } else if (rewardForStay < rewardForJump) {
            return this.actionSet.JUMP;
        } else {
            return this.actionSet.STAY;
        }
    },
    rewardTheBird: function (s, a) {
        var rewardForState = 0;
        var futureState = this.getState();
        if (started == true) {
            rewardForState = 1;
        } else {
            rewardForState = -1000;
        }
        var optimalFutureValue = Math.max(this.getQ(futureState, this.actionSet.STAY), this.getQ(futureState, this.actionSet.JUMP));
        var updateValue = this.alpha * (rewardForState + this.gamma * optimalFutureValue - this.getQ(s, a));
        this.setQ(s, a, updateValue);
    }
}

// Update reinforcement learning results in HTML
function updateResults(state, action, reward) {
    document.getElementById("currentState").textContent = state;
    document.getElementById("lastAction").textContent = action;
    document.getElementById("lastReward").textContent = reward;
}

function resetGame() {
    started = false;
    gameCounter++; // Increment the game counter when a game is reset
    updateGameCounter(); // Update the counter in the HTML
}

// Function to update the point counter when a point is scored
function scorePoint() {
    // Check if pointsEarned is empty or if the last game number is different from the current one
    if (pointsEarned.length === 0 || pointsEarned[pointsEarned.length - 1] !== gameCounter) {
        pointsEarned.push(gameCounter);
    }
    updatePointCounter();
}

// Function to play the game using reinforcement learning
function play() {
    if (lv_init == 'X') {
        lv_init = '';
        env = new FlappyBird();
        env.reset();
        lv_state = env.getState();
        lv_action = env.getAction(lv_state);
        env.implementAction(lv_action);
    } else {
        env.rewardTheBird(lv_state, lv_action);
        if (started == true) {
            lv_state = env.getState();
            lv_action = env.getAction(lv_state);
            env.implementAction(lv_action);
            updateResults(lv_state.toString(), lv_action, lv_reward);
        } else {
            resetGame();
            inputHandler();
            pipeDelay = 0;
            f = 0;
        }
    }
}

updateGameCounter();

updatePointCounter();
