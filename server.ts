import express, { Request, Response } from 'express'
// Import Node.js Buffer type
import { Buffer } from 'buffer'
import { Octokit } from '@octokit/rest'
import rateLimit from 'express-rate-limit'
import { RequestError } from '@octokit/request-error' // Import Octokit RequestError for error handling

const app = express()
const port = 3000

// GitHub API client setup
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN, // Set your GitHub token in environment variables
})

// Rate limiter to prevent abuse
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 requests per windowMs
})

// Apply rate limiting middleware
app.use(limiter)

app.use(express.urlencoded({ extended: true }))

app.get('/', (req: Request, res: Response) => {
    // Serve confirmation HTML with repo name input
    res.send(`
        <html>
        <body>
            <h2>Do you want to commit README.md and trigger deployment?</h2>
            <form method="POST">
                <label for="repoName">Repository Name:</label>
                <input type="text" id="repoName" name="repoName" required />
                <br/><br/>
                <button type="submit" name="confirm" value="yes">Yes</button>
                <button type="submit" name="confirm" value="no">No</button>
            </form>
        </body>
        </html>
    `)
})

app.post('/', async (req: Request, res: Response) => {
    const { repoName, confirm } = req.body
    if (typeof repoName !== 'string' || repoName.trim() === '') {
        return res.status(400).send('Invalid repository name.')
    }
    if (confirm !== 'yes') {
        return res.send('Commit cancelled.')
    }
    const owner = 'The-Matrix-Labs'
    const repo = repoName.trim()
    try {
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'README.md',
        })
        if (!('content' in data) || typeof data.content !== 'string') {
            throw new Error('README.md content not found.')
        }
        let content = Buffer.from(data.content, 'base64').toString('utf-8')
        content += ' '
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: 'README.md',
            message: 'Update README.md',
            content: Buffer.from(content).toString('base64'),
            sha: data.sha,
        })
        res.send('README updated successfully.')
    } catch (error: unknown) {
        if (error instanceof RequestError && (error as RequestError).status === 404) {
            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: 'README.md',
                message: 'Create README.md',
                content: Buffer.from(' ').toString('base64'),
            })
            res.send('README created successfully.')
        } else {
            res.status(500).send('Error accessing GitHub API.')
        }
    }
})

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`)
})
