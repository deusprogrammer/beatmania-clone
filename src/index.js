import Phaser from 'phaser';
import beatRed from './assets/beat-red.png';
import beatBlue from './assets/beat-blue.png';
import beatHit from './assets/beat-hit.png';
import futureRespawningButton from './assets/future-respawning-button.mp3';
import smooooooch from './assets/smooooch.mp3';
import smoooochTiming from './smooooch.timing';

const PERFECT_TIMING = 16.67;
const GREAT_TIMING = 33.3;
const GOOD_TIMING = 116.67;
const BAD_TIMING = 250;
const POOR_TIMING = 260;
const MINIMUM_HOLD_TIME = 500;

const Y_ZERO = 1000;
const COLUMNS = 5;
const TEXT_Y_OFFSET = 800;
const MS_PER_ELEMENT = 1000;

const LABELS = ['a', 'b', 'd/l', ';', "'"];

class MyGame extends Phaser.Scene {
    constructor() {
        super();
        this.lastTime = 0;
        this.averageDelta = null;
        this.timeOffset = 0;

        this.song1 = null;
        this.controls = null;

        this.hitCount = 0;
        this.totalBeats = 0;

        this.bpm = 120;
        this.speed = 1;

        this.modeText = null;
        this.hitCountText = null;
        this.timeText = null;
        this.deltaText = null;
        this.speedText = null;
        this.bpmText = null;
        this.gradeText = null;
        this.gradeTextTween = null;

        this.showLines = false;

        this.beatLines = [];
        this.beatBackgrounds = [];

        this.beats = new Array(COLUMNS);
        for (let column = 0; column < COLUMNS; column++) {
            this.beats[column] = new Array();
        }

        this.beatsArray = new Array();
        this.linesArray = new Array();

        if (localStorage.getItem('recordedChart')) {
            this.recordedBeats = JSON.parse(
                localStorage.getItem('recordedChart')
            );
        } else {
            this.recordedBeats = new Array(COLUMNS);
            for (let column = 0; column < COLUMNS; column++) {
                this.recordedBeats[column] = new Array();
            }
        }

        this.beatLineIsPressed = new Array(COLUMNS).fill(false);
        this.beatLineHoldTimeStarted = new Array(COLUMNS).fill(-1);
        this.nextBeatsIndex = new Array(COLUMNS).fill(0);
        this.nextBeatHit = new Array(COLUMNS).fill(false);

        this.timeStarted = null;
        this.mode = 'paused';

        this.beatSprites = [];
        this.lineSprites = [];
    }

    preload() {
        this.load.image('beat-red', beatRed);
        this.load.image('beat-blue', beatBlue);
        this.load.image('beat-hit', beatHit);
        this.load.audio('smooooooch', smooooooch);
        this.load.audio('futureRespawningButton', futureRespawningButton);
    }

    create() {
        this.controls = {
            beats: [
                [this.input.keyboard.addKey('A')],
                [this.input.keyboard.addKey('S')],
                [
                    this.input.keyboard.addKey('D'),
                    this.input.keyboard.addKey('L'),
                ],
                [
                    this.input.keyboard.addKey(
                        Phaser.Input.Keyboard.KeyCodes.SEMICOLON
                    ),
                ],
                [
                    this.input.keyboard.addKey(
                        Phaser.Input.Keyboard.KeyCodes.QUOTES
                    ),
                ],
            ],
            hold: this.input.keyboard.addKey(
                Phaser.Input.Keyboard.KeyCodes.SHIFT
            ),
        };

        // Set up button press for fullscreen
        this.input.keyboard.on('keydown', (event) => {
            console.table(event);
            if (event.key === 'f') {
                this.scale.startFullscreen();
            } else if (event.key === 'y') {
                this.showLines = !this.showLines;
                this.createLineTimings(this.bpm);
            } else if (event.key === 'e') {
                if (this.mode !== 'playing') {
                    this.timeOffset = 0;
                }
                this.mode = 'editting';
                this.modeText.setText('mode: editting');
                this.showLines = true;
                this.song1.pause();
                this.song2.pause();
                this.song2.removeMarker('resume');
                this.song2.addMarker({
                    name: 'resume',
                    start: this.timeOffset / 1000,
                });
                this.beats = this.recordedBeats;

                this.createLineTimings(this.bpm);
                this.createBeatArray(this.beats);

                this.totalBeats = this.beats.reduce((acc, curr) => {
                    return acc + curr.length;
                }, 0);
            } else if (event.key === 'p') {
                this.mode = 'playing';
                this.modeText.setText(`mode: ${this.mode}`);
                this.showLines = false;
                this.reset();
                this.song1.stop();
                this.song2.stop();
                this.beats = smoooochTiming;
                this.createLineTimings(this.bpm);
                this.createBeatArray(smoooochTiming);
                this.totalBeats = this.beats.reduce((acc, curr) => {
                    return acc + curr.length;
                }, 0);
                this.timeOffset = 0;
                this.song1.play();
            } else if (event.key === 't') {
                if (this.mode !== 'editting') {
                    this.song1.stop();
                    this.song2.stop();
                    this.timeOffset = 0;
                    this.reset();
                    this.beats = this.recordedBeats;
                    this.createLineTimings(this.bpm);
                    this.createBeatArray(this.recordedBeats);
                    this.totalBeats = this.beats.reduce((acc, curr) => {
                        return acc + curr.length;
                    }, 0);
                    this.song2.play();
                } else {
                    this.song2.play('resume');
                    // this.song2.resume();
                }
                this.mode = 'playing';
                this.modeText.setText(`mode: test`);
                this.showLines = true;
            } else if (event.key === 'r') {
                this.mode = 'recording';
                this.modeText.setText(`mode: ${this.mode}`);
                this.recordedBeats = new Array(COLUMNS);
                for (let column = 0; column < COLUMNS; column++) {
                    this.recordedBeats[column] = new Array();
                }
                this.timeOffset = 0;
                this.song2.play();
            } else if (event.key === 'Enter') {
                if (this.mode !== 'recording') {
                    return;
                }
                this.mode = 'paused';
                this.modeText.setText(`mode: ${this.mode}`);
                this.song1.stop();
                console.log(
                    'export default ' +
                        JSON.stringify(this.recordedBeats, null, 5)
                );
                localStorage.setItem(
                    'recordedChart',
                    JSON.stringify(this.recordedBeats)
                );
            } else if (event.key === 'o') {
                this.mode = 'paused';
                this.song1.pause();
                this.song2.pause();
            } else if (event.key === 'ArrowUp') {
                this.bpm += 1;
                this.bpmText.setText('BPM: ' + this.bpm);
                this.createLineTimings(this.bpm);
            } else if (event.key === 'ArrowDown') {
                this.bpm -= 1;
                this.bpmText.setText('BPM: ' + this.bpm);
                this.createLineTimings(this.bpm);
            } else if (event.key === 'ArrowLeft') {
                this.speed -= 0.1;
                this.speedText.setText(`Speed: ${this.speed}X`);
            } else if (event.key === 'ArrowRight') {
                this.speed += 0.1;
                this.speedText.setText(`Speed: ${this.speed}X`);
            }
        });
        this.input.on(
            'wheel',
            (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
                this.timeOffset += deltaY;

                if (this.timeOffset < 0) {
                    this.timeOffset = 0;
                }

                this.song2.removeMarker('resume');
                this.song2.addMarker({
                    name: 'resume',
                    start: this.timeOffset / 1000,
                });
            }
        );

        // Hit count text
        this.modeText = this.add.text(TEXT_Y_OFFSET, 0, `Mode:`, {
            color: 'white',
        });
        this.hitCountText = this.add.text(
            TEXT_Y_OFFSET,
            20,
            `Hits: ${this.hitCount}/???`,
            { color: 'white' }
        );
        this.timeText = this.add.text(TEXT_Y_OFFSET, 40, `Time:  `, {
            color: 'white',
        });
        this.deltaText = this.add.text(TEXT_Y_OFFSET, 60, `Delta: `, {
            color: 'white',
        });
        this.bpmText = this.add.text(TEXT_Y_OFFSET, 80, `BPM: ${this.bpm}`, {
            color: 'white',
        });
        this.speedText = this.add.text(
            TEXT_Y_OFFSET,
            100,
            `Speed: ${this.speed}X`,
            {
                color: 'white',
            }
        );
        this.gradeText = this.add
            .text(256 + 64, Y_ZERO, ``, { color: 'white', fontSize: '60px' })
            .setOrigin(0.5, 0.5)
            .setDepth(5);

        let textTween = this.add.tween({
            targets: [this.gradeText],
            ease: 'Linear',
            duration: 250,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
        });

        this.gradeTextTween = textTween;

        // Setup columns
        for (let column = 0; column < COLUMNS + 1; column++) {
            if (column < COLUMNS) {
                this.add
                    .line(
                        64,
                        0,
                        column * 128,
                        Y_ZERO,
                        (column + 1) * 128,
                        Y_ZERO,
                        0xffffff,
                        1.0
                    )
                    .setDepth(100);
                this.beatLines.push(
                    this.add
                        .image(64 + column * 128, Y_ZERO, 'beat-hit')
                        .setVisible(false)
                        .setDepth(200)
                );

                this.add
                    .text(64 + column * 128, Y_ZERO + 50, LABELS[column], {
                        color: 'white',
                        fontSize: '20px',
                    })
                    .setOrigin(0.5, 0.5);

                const graphics = this.add.graphics();
                graphics.fillGradientStyle(
                    0xff0000,
                    0xff0000,
                    0xffff00,
                    0xffff00,
                    1
                );
                graphics.fillRect(column * 128, 0, 128, Y_ZERO);
                graphics.setDepth(0);
                graphics.setVisible(false);
                let tween = this.add.tween({
                    targets: [graphics],
                    ease: 'Linear',
                    duration: 250,
                    alpha: 0,
                });
                this.beatBackgrounds.push(tween);
            }
            this.add.line(
                0,
                0,
                column * 128,
                0,
                column * 128,
                3000,
                0xffffff,
                1.0
            );
        }

        // Load song
        this.song1 = this.sound.add('smooooooch');
        this.song2 = this.sound.add('futureRespawningButton');
    }

    renderBeats() {
        let showLines = this.showLines;

        // Clear beat sprites
        let beatSprite;
        while ((beatSprite = this.beatSprites.shift())) {
            beatSprite.destroy();
        }

        // Clear line sprites
        let lineSprite;
        while ((lineSprite = this.lineSprites.shift())) {
            lineSprite.destroy();
        }

        // Draw the visible beats
        let lower = Math.trunc(
            Math.max((this.timeOffset - 1000 / this.speed) / MS_PER_ELEMENT, 0)
        );
        let upper = Math.trunc(
            Math.min(
                this.beatsArray.length,
                (this.timeOffset + 1000 / this.speed + MS_PER_ELEMENT) /
                    MS_PER_ELEMENT
            )
        );

        for (let i = lower; i < upper; i++) {
            if (showLines) {
                let lineTimingWindow = this.linesArray[i];
                lineTimingWindow.forEach(({ ms, color }) => {
                    let lineSprite = this.add
                        .line(
                            0,
                            0,
                            0,
                            Y_ZERO - (ms - this.timeOffset) * this.speed,
                            1280,
                            Y_ZERO - (ms - this.timeOffset) * this.speed,
                            color,
                            0.5
                        )
                        .setDepth(1000);

                    this.lineSprites.push(lineSprite);
                });
            }

            let beat = this.beatsArray[i];
            if (!beat || beat === []) {
                continue;
            }
            beat.forEach(({ ms, end, column }) => {
                let beatSprite;
                if (!end) {
                    beatSprite = this.add
                        .image(
                            64 + column * 128,
                            Y_ZERO - (ms - this.timeOffset) * this.speed,
                            'beat-red'
                        )
                        .setScale(1, this.speed)
                        .setDepth(3);
                } else {
                    let startY = Y_ZERO - (ms - this.timeOffset) * this.speed;
                    let endY = Y_ZERO - (end - this.timeOffset) * this.speed;
                    let duration = startY - endY;
                    beatSprite = this.add
                        .image(64 + column * 128, startY, 'beat-blue')
                        .setScale(1, this.speed)
                        .setDepth(3);
                    this.beatSprites.push(beatSprite);
                    beatSprite = this.add
                        .image(64 + column * 128, endY, 'beat-blue')
                        .setScale(1, this.speed)
                        .setDepth(3);
                    this.beatSprites.push(beatSprite);
                    beatSprite = this.add
                        .rectangle(
                            64 + column * 128,
                            endY,
                            128,
                            duration,
                            0x0000ff
                        )
                        .setOrigin(0.5, 0)
                        .setDepth(2);
                }
                this.beatSprites.push(beatSprite);
            });
        }
    }

    update(time, delta) {
        this.lastTime = this.timeOffset;
        if (this.mode === 'playing' || this.mode === 'recording') {
            this.timeOffset += delta;
        }

        // Display the avg delta between frames
        let lastTimeSeconds = Math.trunc(this.lastTime / 1000);
        let updateAvg = lastTimeSeconds !== Math.trunc(this.timeOffset / 1000);
        if (updateAvg) {
            if (!this.averageDelta) {
                this.averageDelta = delta;
            } else {
                this.averageDelta = (this.averageDelta + delta) / 2;
            }
            this.deltaText.setText(`Delta: ${this.averageDelta.toFixed(3)}ms`);
        }

        // Reset line color to white
        this.beatLines.forEach((beatLine) => beatLine.setVisible(false));

        if (this.mode === 'editting') {
            this.timeText.setText(`Time:  ${this.timeOffset / 1000}s`);
            this.renderBeats();
        } else if (this.mode === 'playing') {
            this.timeText.setText(
                `Time:  ${Math.trunc(this.timeOffset / 1000)}s`
            );
            this.renderBeats();

            // Check the next beats for misses
            for (let column = 0; column < COLUMNS; column++) {
                // If there are no more beats we can skip this column
                if (this.nextBeatsIndex[column] >= this.beats[column].length) {
                    continue;
                }

                // Advance next beat index and register misses
                let { ms, end } =
                    this.beats[column][this.nextBeatsIndex[column]];
                if (!end && this.timeOffset >= ms + POOR_TIMING) {
                    if (!this.nextBeatHit[column]) {
                        this.showHit('MISS', 'red', column, false);

                        this.nextBeatHit[column] = false;
                        this.nextBeatsIndex[column]++;
                    }
                } else if (end && this.timeOffset >= end + POOR_TIMING) {
                    if (!this.nextBeatHit[column]) {
                        this.showHit('MISS', 'red', column, false);

                        this.nextBeatHit[column] = false;
                        this.nextBeatsIndex[column]++;
                    }
                }
            }
        }

        // Handles button release
        this.beatLineIsPressed.forEach((isPressed, column) => {
            if (isPressed && this.isUp(column)) {
                this.beatLineIsPressed[column] = false;

                if (
                    this.mode === 'recording' &&
                    this.timeOffset - this.beatLineHoldTimeStarted[column] >=
                        MINIMUM_HOLD_TIME
                ) {
                    let { ms } = this.recordedBeats[column].pop();
                    this.recordedBeats[column].push({
                        ms,
                        end: this.timeOffset,
                    });
                    this.beatLineHoldTimeStarted[column] = -1;
                } else if (
                    this.mode === 'playing' &&
                    this.timeOffset - this.beatLineHoldTimeStarted[column] >=
                        MINIMUM_HOLD_TIME &&
                    this.beats[column][this.nextBeatsIndex[column]] &&
                    this.beats[column][this.nextBeatsIndex[column]].end
                ) {
                    // If there are no more beats we can skip this column
                    if (
                        this.nextBeatsIndex[column] >= this.beats[column].length
                    ) {
                        return;
                    }

                    let { end } =
                        this.beats[column][this.nextBeatsIndex[column]];

                    this.gradeHit(end, this.timeOffset, column);

                    // if (isHit) {
                    this.nextBeatHit[column] = false;
                    this.nextBeatsIndex[column]++;
                    // }

                    this.beatLineHoldTimeStarted[column] = -1;
                    this.beatLineIsPressed[column] = false;
                }
            }
        });

        // Handles button press
        this.controls.beats.forEach((beat, column) => {
            if (this.isDown(column)) {
                this.beatLines[column].visible = true;

                // If playing check timing of button press
                if (
                    this.mode === 'playing' &&
                    !this.beatLineIsPressed[column]
                ) {
                    // If there are no more beats we can skip this column
                    if (
                        this.nextBeatsIndex[column] >= this.beats[column].length
                    ) {
                        return;
                    }

                    let { ms, end } =
                        this.beats[column][this.nextBeatsIndex[column]];

                    let isHit = this.gradeHit(ms, this.timeOffset, column);
                    if (!end && isHit) {
                        this.nextBeatHit[column] = false;
                        this.nextBeatsIndex[column]++;
                    }
                } else if (
                    this.mode === 'recording' &&
                    !this.beatLineIsPressed[column]
                ) {
                    // Recording a button press
                    this.recordedBeats[column].push({
                        ms: this.timeOffset,
                    });
                }
                this.beatLineIsPressed[column] = true;
                if (this.beatLineHoldTimeStarted[column] === -1) {
                    this.beatLineHoldTimeStarted[column] = this.timeOffset;
                }
            }
        });
    }

    showHit(rating, color, column, isHit = true) {
        if (isHit) {
            this.hitCount++;
            this.hitCountText.setText(
                `Hits: ${this.hitCount}/${this.totalBeats}`
            );
            this.beatBackgrounds[column].targets[0].setVisible(true);
            this.beatBackgrounds[column].restart();
        }
        this.gradeText.setText(rating);
        this.gradeTextTween.restart();
        this.gradeText.setFill(color);
    }

    gradeHit(ms, timeSinceStart, column) {
        if (
            timeSinceStart >= ms - PERFECT_TIMING &&
            timeSinceStart <= ms + PERFECT_TIMING
        ) {
            this.showHit('PERFECT', 'yellow', column);
        } else if (
            timeSinceStart >= ms - GREAT_TIMING &&
            timeSinceStart <= ms + GREAT_TIMING
        ) {
            this.showHit('GREAT', 'lime', column);
        } else if (
            timeSinceStart >= ms - GOOD_TIMING &&
            timeSinceStart <= ms + GOOD_TIMING
        ) {
            this.showHit('GOOD', 'lightblue', column);
        } else if (
            timeSinceStart >= ms - BAD_TIMING &&
            timeSinceStart <= ms + BAD_TIMING
        ) {
            this.showHit('BAD', 'white', column, false);
        } else if (
            timeSinceStart >= ms - POOR_TIMING &&
            timeSinceStart <= ms + POOR_TIMING
        ) {
            this.showHit('POOR', 'gray', column, false);
        } else {
            this.nextBeatHit[column] = false;
            console.log('NEXT BEAT OUT OF RANGE');
            return false;
        }
        return true;
    }

    createLineTimings(bpm) {
        let lineTimings = [];
        let bps = bpm / 60;
        for (let beat = 0; beat < 1 * bpm; beat++) {
            for (let i = 0; i < 16; i++) {
                let color;
                switch (i) {
                    case 0:
                        color = 0xffff00;
                        break;
                    case 8:
                        color = 0x00ff00;
                        break;
                    case 4:
                    case 12:
                        color = 0x00ffff;
                        break;
                    default:
                        color = 0xff00ff;
                }
                lineTimings.push({
                    ms: beat * (1000 / bps) + i * (1000 / bps / 16),
                    color,
                });
            }
        }

        return this.createLineArray(lineTimings);
    }

    // Process file into an array of milliseconds
    createBeatArray(beats) {
        this.beatsArray = new Array();
        beats.forEach((column, columnIndex) => {
            column.forEach((beat) => {
                let { ms, end } = beat;

                let endTime = ms;
                if (end) {
                    endTime = end;
                }

                console.log(
                    Math.trunc(ms / MS_PER_ELEMENT) +
                        ' < ' +
                        Math.trunc(endTime / MS_PER_ELEMENT)
                );
                for (
                    let index = Math.trunc(ms / MS_PER_ELEMENT);
                    index < Math.trunc(endTime / MS_PER_ELEMENT) + 1;
                    index++
                ) {
                    console.log(index + 's');
                    if (!this.beatsArray[index]) {
                        this.beatsArray[index] = [];
                    }
                    this.beatsArray[index].push({
                        column: columnIndex,
                        ms: Math.trunc(ms),
                        end: Math.trunc(end),
                    });
                }
            });
        });
        console.log('BEATS ARRAY: ' + JSON.stringify(this.beatsArray, null, 5));
    }

    // Process file into an array of milliseconds
    createLineArray(lines) {
        this.linesArray = new Array();
        lines.forEach((line) => {
            let { ms, color } = line;
            let index = Math.trunc(ms / MS_PER_ELEMENT);
            console.log(index + 's');
            if (!this.linesArray[index]) {
                this.linesArray[index] = [];
            }
            this.linesArray[index].push({
                ms: Math.trunc(ms),
                color,
            });
        });
        console.log('LINES ARRAY: ' + JSON.stringify(this.linesArray, null, 5));
    }

    isDown(column) {
        return this.controls.beats[column].reduce(
            (acc, curr) => acc || curr.isDown,
            false
        );
    }

    isUp(column) {
        return this.controls.beats[column].reduce(
            (acc, curr) => acc && curr.isUp,
            true
        );
    }

    reset() {
        this.beatLineIsPressed = new Array(COLUMNS).fill(false);
        this.nextBeatsIndex = new Array(COLUMNS).fill(0);
        this.nextBeatHit = new Array(COLUMNS).fill(false);
        this.hitCount = 0;
    }
}

const screenWidth = window.view;

const config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 1920,
    height: 1080,
    scale: {
        mode: Phaser.Scale.FIT,
        parent: 'phaser-example',
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1920,
        height: 1080,
    },
    scene: MyGame,
};

const game = new Phaser.Game(config);
