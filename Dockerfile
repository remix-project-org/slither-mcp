# syntax=docker/dockerfile:1.6

###
### Medusa build process
###
FROM golang:1.25 AS medusa

WORKDIR /src
RUN git clone https://github.com/crytic/medusa.git
RUN cd medusa && \
    export LATEST_TAG="$(git describe --tags | sed 's/-[0-9]\+-g\w\+$//')" && \
    git checkout "$LATEST_TAG" && \
    go build -trimpath -o=/usr/local/bin/medusa -ldflags="-s -w" && \
    chmod 755 /usr/local/bin/medusa


###
### Echidna "build process"
###
FROM ghcr.io/crytic/echidna/echidna:latest AS echidna
RUN chmod 755 /usr/local/bin/echidna


###
### ETH Security Toolbox + Slither MCP Server
###
FROM ubuntu:jammy AS slither-mcp-toolbox

# Add common tools
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    bash-completion \
    curl \
    git \
    jq \
    python3-pip \
    python3-venv \
    sudo \
    unzip \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Add n (node version manager), lts node, npm, and yarn
RUN npm install -g n yarn && \
    n stable --cleanup && n prune && npm --force cache clean

# Include echidna
COPY --chown=root:root --from=echidna /usr/local/bin/echidna /usr/local/bin/echidna

# Include medusa
COPY --chown=root:root --from=medusa /usr/local/bin/medusa /usr/local/bin/medusa
RUN medusa completion bash > /etc/bash_completion.d/medusa

# Add a user with passwordless sudo
RUN useradd -m ethsec && \
    usermod -aG sudo ethsec && \
    echo 'ethsec ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers

##### user-level setup follows
##### Things should be installed in $HOME from now on
USER ethsec
WORKDIR /home/ethsec
ENV HOME="/home/ethsec"
ENV PATH="${PATH}:${HOME}/.local/bin:${HOME}/.vyper/bin:${HOME}/.foundry/bin"

# Install vyper compiler
RUN python3 -m venv ${HOME}/.vyper && \
    ${HOME}/.vyper/bin/pip3 install --no-cache-dir vyper && \
    echo '\nexport PATH=${PATH}:${HOME}/.vyper/bin' >> ~/.bashrc

# Install foundry
RUN curl -fsSL https://raw.githubusercontent.com/foundry-rs/foundry/27cabbd6c905b1273a5ed3ba7c10acce90833d76/foundryup/install -o install && \
    if [ ! "e4456a15d43054b537b329f6ca6d00962242050d24de4c59657a44bc17ad8a0c  install" = "$(sha256sum install)" ]; then \
        echo "Foundry installer does not match expected checksum! exiting"; \
        exit 1; \
    fi && \
    cat install | SHELL=/bin/bash bash && rm install && \
    foundryup && \
    COMPLETIONS="${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion/completions" && \
    mkdir -p "${COMPLETIONS}" && \
    for tool in anvil cast forge; do \
        "$tool" completions bash > "${COMPLETIONS}/$tool"; \
    done

# Install python tools including slither
RUN pip3 install --no-cache-dir --user \
    pyevmasm \
    solc-select \
    crytic-compile \
    slither-analyzer

# Install one solc release from each branch and select the latest version as the default
RUN solc-select install 0.4.26 0.5.17 0.6.12 0.7.6 latest && solc-select use latest

# Clone useful repositories
RUN git clone --depth 1 https://github.com/crytic/building-secure-contracts.git

# Install MCP server
USER root
WORKDIR /app

# Copy and install Node.js dependencies
COPY package.json ./
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript application
RUN npm run build

# Switch back to ethsec user
USER ethsec
WORKDIR /home/ethsec

# Expose the MCP server port
EXPOSE 9005

# Create startup script that runs MCP server but allows shell access
RUN echo '#!/bin/bash\n\
# Start MCP server in background if PORT is set\n\
if [ ! -z "$PORT" ]; then\n\
    echo "Starting Slither MCP server on port $PORT..."\n\
    cd /app && npm start &\n\
    MCP_PID=$!\n\
    \n\
    # Function to cleanup on exit\n\
    cleanup() {\n\
        echo "Shutting down MCP server..."\n\
        kill $MCP_PID 2>/dev/null\n\
        exit 0\n\
    }\n\
    \n\
    # Trap exit signals\n\
    trap cleanup SIGTERM SIGINT\n\
    \n\
    echo "MCP server started (PID: $MCP_PID)"\n\
    echo "Access shell: docker compose exec slither-mcp bash"\n\
    echo "Health check: curl http://localhost:9005/health"\n\
    \n\
    # Wait for MCP server\n\
    wait $MCP_PID\n\
else\n\
    # Just start a shell\n\
    exec /bin/bash "$@"\n\
fi' > /home/ethsec/start.sh && chmod +x /home/ethsec/start.sh

# Default command starts MCP server, but can be overridden for shell access
CMD ["/home/ethsec/start.sh"]
