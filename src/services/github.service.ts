import { Octokit } from '@octokit/rest'
import { RequestError } from '@octokit/request-error'
import { Buffer } from 'buffer'

export class GitHubService {
    private octokit: Octokit

    constructor(token: string) {
        this.octokit = new Octokit({
            auth: token,
        })
    }

    async updateReadme(owner: string, repo: string): Promise<string> {
        try {
            const { data } = await this.octokit.repos.getContent({
                owner,
                repo,
                path: 'README.md',
            })

            if (!('content' in data) || typeof data.content !== 'string') {
                throw new Error('README.md content not found.')
            }

            let content = Buffer.from(data.content, 'base64').toString('utf-8')
            content += ' '

            await this.octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: 'README.md',
                message: 'Update README.md',
                content: Buffer.from(content).toString('base64'),
                sha: data.sha,
            })

            return 'README updated successfully.'
        } catch (error: unknown) {
            if (error instanceof RequestError && error.status === 404) {
                await this.octokit.repos.createOrUpdateFileContents({
                    owner,
                    repo,
                    path: 'README.md',
                    message: 'Create README.md',
                    content: Buffer.from(' ').toString('base64'),
                })
                return 'README created successfully.'
            }
            throw error
        }
    }
}
