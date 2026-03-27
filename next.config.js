/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdfkit', 'googleapis', '@slack/web-api'],
}

module.exports = nextConfig
