FROM gitpod/workspace-full

# Install pnpm (required for this project)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install Fly
RUN curl -L https://fly.io/install.sh | sh
ENV FLYCTL_INSTALL="/home/gitpod/.fly"
ENV PATH="$FLYCTL_INSTALL/bin:$PATH"

# Install GitHub CLI
RUN brew install gh
