# Security Policy

This document outlines the security policy for the BLE2WebSvc project.

## Supported Versions

As this is an open-source project, only the latest version in the `main` branch is actively supported. We encourage users to keep their installations up-to-date to benefit from the latest features and security patches.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

## Reporting a Vulnerability

We take all security vulnerabilities seriously. If you discover a security issue, please report it to us by creating an issue in our GitHub repository.

When reporting a vulnerability, please provide the following information:

- A clear and concise description of the vulnerability.
- Steps to reproduce the vulnerability.
- Any relevant logs, screenshots, or other supporting materials.

We will acknowledge your report within 48 hours and will keep you informed of our progress in addressing the issue. We kindly ask that you do not publicly disclose the vulnerability until we have had a chance to address it.

## Security Best Practices

To ensure the security of your BLE2WebSvc installation, we recommend the following best practices:

- **Enable Token Authentication**: Always start the server with the `MCP_TOKEN` environment variable set to a strong, unique secret. This will require all clients to authenticate before they can access the server's functionality.
- **Firewall Configuration**: If the server is exposed to a public network, ensure that your firewall is configured to only allow access from trusted IP addresses.
- **Keep Dependencies Up-to-Date**: Regularly update the project's dependencies to ensure that you are not exposed to any known vulnerabilities in the libraries we use. You can do this by running `npm install` and then `npm audit` to check for vulnerabilities.

By following these best practices, you can help to ensure the security of your BLE2WebSvc installation.
