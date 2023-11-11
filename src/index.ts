import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'stream';

export interface Listener<T> {
    (event: T): any;
}

export class FFMpegRenewed extends EventEmitter {

    private cmd: string = 'ffmpeg';
    private ffProcess: ChildProcess | undefined
    private args: string[]
    private url: string
    private fps: number = 10
    private buffs: Buffer[] = []

    constructor(settings:
        {
            cmd?: string,
            fps?: number,
            url: string,
            args?: string[]
        }) {
        super()

        if (settings.cmd) {
            this.cmd = settings.cmd
        }

        if (!settings.url || settings.url.trim() === '') {
            throw new Error('invalid url')
        }

        this.url = settings.url

        if (settings.fps) {
            this.fps = settings.fps
        }

        if (!settings.args) {
            this.args = []
        } else {
            this.args = settings.args
        }
    }

    private generateArgs() {
        return this.args.concat(
            this.args,
            [
                '-loglevel', 'quiet',
                '-i', this.url,
                '-r', this.fps.toString()
            ],
            [
                '-f', 'image2',
                '-update', '1',
                '-'
            ]
        )
    }

    public start() {
        this.ffProcess = spawn(this.cmd, this.generateArgs())

        this.ffProcess.stdout?.on('data', (data: Buffer) => {
            if (data.length > 1) {
                this.buffs.push(data)
                const offset = data[data.length - 2].toString(16)
                const secondOffset = data[data.length - 1].toString(16)
                if (offset === 'ff' && secondOffset === 'd9') {
                    this.emit('data', Buffer.concat(this.buffs))
                    this.buffs = []
                }
            }
        })

        this.ffProcess.stderr?.on('data', (data) => {
            throw new Error(data)
        })

        this.ffProcess.on('close', (code) => {
            if (code === 0) {
                setTimeout(() => {
                    this.start();
                }, 1000)
            }
        })

        this.ffProcess.on('error', (err) => {
            if (err.name === 'ENOENT') {
                throw new Error('FFMpeg executable wasn\'t found. Install this package and check FFMpeg.cmd property');
            }
            throw err
        })

        this.emit('started')
    }

    public stop() {
        if (this.ffProcess) {
            this.ffProcess.kill()
        }
        delete this.ffProcess
        this.emit('stopped')
    }

    public restart() {
        this.stop()
        this.start()
        this.emit('restarted')
    }
}