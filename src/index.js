import Phaser from 'phaser';
import beatRed from './assets/beat-red.png';
import beatHit from './assets/beat-hit.png';
import smooooooch from './assets/smooooch.mp3';
import smoooochTiming from './smooooch.timing';

const PERFECT_TIMING = 16.67;
const GREAT_TIMING = 33.3;
const GOOD_TIMING = 116.67;
const BAD_TIMING = 250;
const POOR_TIMING = 500;
const Y_ZERO = 1000;
const COLUMNS = 5;
const TEXT_Y_OFFSET = 800;

const LABELS = ['a', 'b', 'd/l', ';', "'"];

class MyGame extends Phaser.Scene {
    constructor() {
        super();
        this.lastTime = 0;
        this.averageDelta = null;

        this.song = null;
        this.controls = null;

        this.hitCount = 0;
        this.totalBeats = 0;
        this.hitCountText = null;
        this.timeText = null;
        this.deltaText = null;
        this.gradeText = null;
        this.gradeTextTween = null;

        this.beatLines = [];
        this.beatBackgrounds = [];

        this.beats = new Array(COLUMNS);
        for (let column = 0; column < COLUMNS; column++) {
            this.beats[column] = new Array();
        }

        this.beatLineIsPressed = new Array(COLUMNS).fill(false);
        this.nextBeatsIndex = new Array(COLUMNS).fill(0);
        this.nextBeatHit = new Array(COLUMNS).fill(false);

        this.timeStarted = null;
        this.mode = 'paused';

        this.beatSprites = [];
    }

    preload() {
        this.load.image('beat-red', beatRed);
        this.load.image('beat-hit', beatHit);
        this.load.audio('smooooooch', smooooooch);
    }

    create() {
        this.controls = {
            beats: [
                [this.input.keyboard.addKey('A')],
                [this.input.keyboard.addKey('S')],
                [this.input.keyboard.addKey('D'), this.input.keyboard.addKey('L')],
                [this.input.keyboard.addKey(
                    Phaser.Input.Keyboard.KeyCodes.SEMICOLON
                )],
                [this.input.keyboard.addKey(
                    Phaser.Input.Keyboard.KeyCodes.QUOTES
                )],
            ],
            play: this.input.keyboard.addKey('P'),
            record: this.input.keyboard.addKey('R'),
            dump: this.input.keyboard.addKey(
                Phaser.Input.Keyboard.KeyCodes.ENTER
            ),
        };

        // Hit count text
        this.hitCountText = this.add.text(
            TEXT_Y_OFFSET,
            20,
            `Hits: ${this.hitCount}/121`,
            { color: 'white' }
        );
        this.timeText = this.add.text(TEXT_Y_OFFSET, 40, `Time:  `, {
            color: 'white',
        });
        this.deltaText = this.add.text(TEXT_Y_OFFSET, 60, `Delta: `, {
            color: 'white',
        });
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
            scaleY: 2
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
                    .text(64 + column * 128, Y_ZERO + 50, LABELS[column], { color: 'white', fontSize: "20px" })
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
            this.add.line(0, 0, column * 128, 0, column * 128, 3000, 0xffffff, 1.0);
        }

        this.song = this.sound.add('smooooooch');
    }

    isDown(column) {
        return this.controls.beats[column].reduce((acc, curr) => acc || curr.isDown, false);
    }

    isUp(column) {
        return this.controls.beats[column].reduce((acc, curr) => acc || curr.isUp, false);
    }

    update(time, delta) {
        if (!this.averageDelta) {
            this.averageDelta = delta;
        } else {
            this.averageDelta = (this.averageDelta + delta) / 2;
        }

        // Calculate the time since the song started
        let lastTimeSeconds = Math.trunc(this.lastTime / 1000);

        let timeSinceStart = time - this.timeStarted;
        let currentTimeSeconds = Math.trunc(timeSinceStart / 1000);
        let updateAvg = lastTimeSeconds !== currentTimeSeconds;
        this.lastTime = timeSinceStart;

        // Reset line color to white
        this.beatLines.forEach((beatLine) => beatLine.setVisible(false));

        // Draw beats and advance next beat index
        if (this.mode === 'playing') {
            // Clear beat sprites
            let beatSprite;
            while ((beatSprite = this.beatSprites.shift())) {
                beatSprite.destroy();
            }

            this.timeText.setText(`Time:  ${currentTimeSeconds}s`);
            if (updateAvg) {
                this.deltaText.setText(
                    `Delta: ${this.averageDelta.toFixed(3)}ms`
                );
            }
            for (let column = 0; column < COLUMNS; column++) {
                // If there are no more beats we can skip this column
                if (this.nextBeatsIndex[column] >= this.beats[column].length) {
                    continue;
                }

                // Draw beats for next second
                let visibleBeats = this.beats[column].filter(
                    ({ ms }) => ms <= timeSinceStart + 1000
                );
                visibleBeats.forEach(({ ms }) => {
                    let beatSprite = this.add
                        .image(
                            64 + column * 128,
                            1000 - (ms - timeSinceStart),
                            'beat-red'
                        )
                        .setDepth(1);
                    this.beatSprites.push(beatSprite);
                });

                // Advance next beat index and register misses
                if (this.mode === 'playing') {
                    let ms = this.beats[column][this.nextBeatsIndex[column]].ms;
                    if (timeSinceStart >= ms + POOR_TIMING) {
                        if (!this.nextBeatHit[column]) {
                            this.gradeText.setText("MISS!").setFill("red");
                            this.gradeTextTween.restart();
                            this.nextBeatHit[column] = false;
                            this.nextBeatsIndex[column]++;
                        }
                    }
                }
            }
        }

        // Clear beat line states if button released
        this.beatLineIsPressed.forEach((isPressed, column) => {
            if (isPressed && this.isUp(column)) {
                this.beatLineIsPressed[column] = false;
            }
        });

        // Handle button press
        this.controls.beats.forEach((beat, column) => {
            if (this.isDown(column)) {
                this.beatLines[column].visible = true;

                // If playing check timing of button press
                if (
                    this.mode === 'playing' &&
                    !this.beatLineIsPressed[column]
                ) {
                    // If there are no more beats we can skip this column
                    if (this.nextBeatsIndex[column] >= this.beats[column].length) {
                        return;
                    }

                    let ms = this.beats[column][this.nextBeatsIndex[column]].ms;

                    // If button is pressed and outside the poor timing window, then do nothing.
                    if (timeSinceStart < ms - POOR_TIMING) {
                        return;
                    }

                    this.nextBeatHit[column] = true;
                    if (
                        timeSinceStart >= ms - PERFECT_TIMING &&
                        timeSinceStart <= ms + PERFECT_TIMING
                    ) {
                        this.hitCount++;
                        this.hitCountText.setText(`Hits: ${this.hitCount}/${this.totalBeats}`);
                        this.gradeText.setText('PERFECT');
                        this.gradeTextTween.restart();
                        this.gradeText.setFill('yellow');
                        this.beatBackgrounds[column].targets[0].setVisible(
                            true
                        );
                        this.beatBackgrounds[column].restart();
                    } else if (
                        timeSinceStart >= ms - GREAT_TIMING &&
                        timeSinceStart <= ms + GREAT_TIMING
                    ) {
                        this.hitCount++;
                        this.hitCountText.setText(`Hits: ${this.hitCount}/${this.totalBeats}`);
                        this.gradeText.setText('GREAT');
                        this.gradeTextTween.restart();
                        this.gradeText.setFill('lime');
                        this.beatBackgrounds[column].targets[0].setVisible(
                            true
                        );
                        this.beatBackgrounds[column].restart();
                    } else if (
                        timeSinceStart >= ms - GOOD_TIMING &&
                        timeSinceStart <= ms + GOOD_TIMING
                    ) {
                        this.hitCount++;
                        this.hitCountText.setText(`Hits: ${this.hitCount}/${this.totalBeats}`);
                        this.gradeText.setText('GOOD');
                        this.gradeTextTween.restart();
                        this.gradeText.setFill('lightblue');
                        this.beatBackgrounds[column].targets[0].setVisible(
                            true
                        );
                        this.beatBackgrounds[column].restart();
                    } else if (
                        timeSinceStart >= ms - BAD_TIMING &&
                        timeSinceStart <= ms + BAD_TIMING
                    ) {
                        this.gradeText.setText('BAD');
                        this.gradeTextTween.restart();
                        this.gradeText.setFill('white');
                    } else if (
                        timeSinceStart >= ms - POOR_TIMING &&
                        timeSinceStart <= ms + POOR_TIMING
                    ) {
                        this.gradeText.setText('POOR');
                        this.gradeTextTween.restart();
                        this.gradeText.setFill('gray');
                    } else {
                        this.nextBeatHit[column] = false;
                    }
                    this.nextBeatHit[column] = false;
                    this.nextBeatsIndex[column]++;
                } else if (
                    this.mode === 'recording' &&
                    !this.beatLineIsPressed[column]
                ) {
                    console.log("Beat recorded for " + column + ": " + timeSinceStart);
                    this.beats[column].push({
                        ms: timeSinceStart,
                    });
                }
                this.beatLineIsPressed[column] = true;
            }
        });

        // Handle state changing buttons
        if (this.controls.record.isDown) {
            this.mode = 'recording';
            this.timeStarted = time;
            this.song.play();
        } else if (this.controls.play.isDown) {
            this.mode = 'playing';
            this.beats = smoooochTiming;
            this.totalBeats = this.beats.reduce((acc, curr) => {
                return acc + curr.length;
            }, 0);
            this.timeStarted = time;
            this.song.play();
        } else if (this.controls.dump.isDown) {
            this.mode === 'paused';
            this.song.stop();
            console.log(
                'export default ' + JSON.stringify(this.beats, null, 5)
            );
        }
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 1920,
    height: 1080,
    scene: MyGame,
};

const game = new Phaser.Game(config);
