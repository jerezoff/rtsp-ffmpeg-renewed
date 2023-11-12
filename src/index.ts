import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'stream';

export interface Listener<T> {
    (event: T): any;
}

export class FFMpegRenewed extends EventEmitter {
    /**
     * This class represents a module that wraps ffmpeg
     * and spawns process which parsing the output
     * 
     * Also you can provide settings to adjust
     * 
     * @param url Is important parameter, fullfill with rtsp stream
     * @param settings You can adjust module here
     * @param settings.fps Preffered output fps
     * @param settings.resolution Preffered output resolution
     * @param settings.cmd Custom ffmpeg call e.g. if you got ENOENT error
     * @param settings.args Custom args for ffmpeg, provide with ['-flag', 'value'] syntax
     */

    private cmd: string = 'ffmpeg';
    private ffProcess: ChildProcess | undefined
    private args: string[]
    private url: string
    private fps: number = 10
    private buffs: Buffer[] = []
    private resolution: string | undefined

    constructor(url: string, settings?:
        {
            fps?: number,
            resolution?: string | undefined
            cmd?: string,
            args?: string[]
        }) {
        super()

        if (settings.cmd) {
            this.cmd = settings.cmd
        }

        if (!url || url.trim() === '') {
            throw new Error('invalid url')
        }

        this.url = url

        if (settings.fps) {
            this.fps = settings.fps
        }

        if (settings.resolution) {
            this.resolution = settings.resolution
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
            this.resolution && ['-s', this.resolution],
            [
                '-f', 'image2',
                '-update', '1',
                '-'
            ]
        )
    }

    public isRunning(): boolean {
        return !!this.ffProcess
    }

    public start(): void {
        /**
         * Starts ffmpeg process
         */
        this.ffProcess = spawn(this.cmd, this.generateArgs())

        if (!this.ffProcess.stdout || !this.ffProcess.stderr) {
            this.stop();
            throw new Error('Failed to bind to stdout or/and stderr')
        }

        this.ffProcess.stdout.on('data', (data: Buffer) => {
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

        this.ffProcess.stderr.on('data', (data) => {
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

    public stop(): void {
        /**
         * Stops ffmpeg process
         */
        if (this.ffProcess) {
            this.ffProcess.kill()
        }
        delete this.ffProcess
        this.emit('stopped')
    }

    public restart(): void {
        /**
         * Restarts ffmpeg process
         */
        this.stop()
        this.start()
        this.emit('restarted')
    }
}