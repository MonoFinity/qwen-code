#!/bin/bash

# This script is designed to simplify the setup of the Docker environment for the qwen-code project.
# It automates the process of building the necessary Docker images and starting the containers.
# By using this script, you can ensure a consistent and reproducible development environment,
# which is crucial for avoiding "it works on my machine" issues.

# --- Prerequisites ---
# 1. Docker Desktop: Make sure you have Docker Desktop installed and running on your system.
#    You can download it from https://www.docker.com/products/docker-desktop
#
# 2. Shell Environment: For Windows users, it is recommended to run this script in a Git Bash
#    or WSL (Windows Subsystem for Linux) terminal to ensure compatibility with bash scripting.

# --- Script Breakdown ---

# `set -e`: This command ensures that the script will exit immediately if any command fails.
# This is a safety measure to prevent the script from continuing in an unpredictable state.
set -e

# `set -x`: This command prints each command and its arguments to the terminal before it is
# executed. This is useful for debugging and understanding what the script is doing at each step.
set -x

# --- Docker Compose Execution ---

# We specify the path to the docker-compose file to ensure the script can be run from the
# project's root directory.
DOCKER_COMPOSE_FILE="docker/docker-compose.yml"

# `docker-compose -f "$DOCKER_COMPOSE_FILE" build`: This command builds the Docker images
# as defined in the `docker-compose.yml` file. It will download any necessary base images
# and run the build steps defined in the Dockerfiles.
echo "Building Docker images..."
docker-compose -f "$DOCKER_COMPOSE_FILE" build

# `docker-compose -f "$DOCKER_COMPOSE_FILE" up -d`: This command starts the Docker containers
# in detached mode (`-d`), which means they will run in the background. This is ideal for
# development, as it frees up your terminal.
echo "Starting Docker containers..."
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d

# --- Completion Message ---
echo "Docker environment has been successfully set up and is now running in the background."
echo "You can now run 'npm run build:all' to perform a complete build of the project."
