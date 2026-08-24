import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useEffect, useRef } from 'react'

type WeatherTheme = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'night'

type FallParticle = {
    leftPct: number
    size: number
    delayMs: number
    durationMs: number
    drift: number
    opacity: number
}

type StarDot = {
    top: number
    leftPct: number
    size: number
    opacity: number
    durationMs: number
}

function makeRainParticles(): FallParticle[] {
    const list: FallParticle[] = []
    for (let i = 0; i < 22; i += 1) {
        list.push({
            leftPct: ((i * 17) % 96) + 2,
            size: 12 + (i % 10),
            delayMs: (i * 140) % 1800,
            durationMs: 750 + (i % 6) * 160,
            drift: 10 + (i % 5) * 5,
            opacity: 0.28 + (i % 5) * 0.08,
        })
    }
    return list
}

function makeSnowParticles(): FallParticle[] {
    const list: FallParticle[] = []
    for (let i = 0; i < 18; i += 1) {
        list.push({
            leftPct: ((i * 19) % 94) + 3,
            size: 3 + (i % 5),
            delayMs: (i * 220) % 2800,
            durationMs: 3200 + (i % 7) * 450,
            drift: ((i % 9) - 4) * 10,
            opacity: 0.5 + (i % 5) * 0.1,
        })
    }
    return list
}

const RAIN_PARTICLES = makeRainParticles()
const SNOW_PARTICLES = makeSnowParticles()

const STAR_DOTS: StarDot[] = [
    { top: 46, leftPct: 8, size: 2, opacity: 0.42, durationMs: 2400 },
    { top: 72, leftPct: 21, size: 1.5, opacity: 0.28, durationMs: 3100 },
    { top: 58, leftPct: 38, size: 2.5, opacity: 0.5, durationMs: 2600 },
    { top: 98, leftPct: 52, size: 1.5, opacity: 0.26, durationMs: 3400 },
    { top: 84, leftPct: 67, size: 2, opacity: 0.38, durationMs: 2200 },
    { top: 50, leftPct: 81, size: 1.5, opacity: 0.3, durationMs: 2900 },
    { top: 120, leftPct: 14, size: 2, opacity: 0.34, durationMs: 2700 },
    { top: 148, leftPct: 33, size: 1.5, opacity: 0.22, durationMs: 3600 },
    { top: 136, leftPct: 73, size: 2.5, opacity: 0.44, durationMs: 2500 },
    { top: 176, leftPct: 88, size: 1.5, opacity: 0.28, durationMs: 3200 },
    { top: 200, leftPct: 6, size: 2, opacity: 0.32, durationMs: 2800 },
    { top: 228, leftPct: 44, size: 1.5, opacity: 0.24, durationMs: 3000 },
    { top: 214, leftPct: 61, size: 2, opacity: 0.36, durationMs: 2300 },
    { top: 256, leftPct: 27, size: 1.5, opacity: 0.2, durationMs: 3500 },
    { top: 270, leftPct: 79, size: 2, opacity: 0.3, durationMs: 2700 },
    { top: 188, leftPct: 93, size: 1.5, opacity: 0.22, durationMs: 3100 },
]

function FallItem({
    particle,
    kind,
    screenH,
}: {
    particle: FallParticle
    kind: 'rain' | 'snow'
    screenH: number
}) {
    const translateY = useRef(new Animated.Value(-50)).current
    const translateX = useRef(new Animated.Value(0)).current

    useEffect(() => {
        let stopped = false

        const runFall = () => {
            translateY.setValue(-50)
            translateX.setValue(0)
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: screenH + 40,
                    duration: particle.durationMs,
                    easing: Easing.linear,
                    useNativeDriver: true,
                    isInteraction: false,
                }),
                Animated.timing(translateX, {
                    toValue: particle.drift,
                    duration: particle.durationMs,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                    isInteraction: false,
                }),
            ]).start((result) => {
                if (result.finished && !stopped) {
                    runFall()
                }
            })
        }

        const timer = setTimeout(runFall, particle.delayMs)
        return () => {
            stopped = true
            clearTimeout(timer)
            translateY.stopAnimation()
            translateX.stopAnimation()
        }
    }, [particle, screenH, translateX, translateY])

    const dropStyle = kind === 'rain'
        ? {
            width: 1.6,
            height: particle.size,
            borderRadius: 2,
            backgroundColor: `rgba(214, 232, 255, ${particle.opacity})`,
        }
        : {
            width: particle.size,
            height: particle.size,
            borderRadius: 99,
            backgroundColor: `rgba(255, 255, 255, ${particle.opacity})`,
        }

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.particle,
                dropStyle,
                {
                    left: `${particle.leftPct}%`,
                    opacity: particle.opacity,
                    transform: [
                        { translateY },
                        { translateX },
                        { rotate: kind === 'rain' ? '14deg' : '0deg' },
                    ],
                },
            ]}
        />
    )
}

function StarItem({ star, screenW }: { star: StarDot; screenW: number }) {
    const opacity = useRef(new Animated.Value(star.opacity)).current

    useEffect(() => {
        const twinkle = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: star.opacity * 0.25,
                    duration: star.durationMs,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                    isInteraction: false,
                }),
                Animated.timing(opacity, {
                    toValue: star.opacity,
                    duration: star.durationMs + 400,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                    isInteraction: false,
                }),
            ]),
        )
        twinkle.start()
        return () => twinkle.stop()
    }, [opacity, star])

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.star,
                {
                    top: star.top,
                    left: (star.leftPct / 100) * screenW,
                    width: star.size,
                    height: star.size,
                    opacity,
                },
            ]}
        />
    )
}

type WeatherFxLayerProps = {
    theme: WeatherTheme
}

/** 비·눈 낙하, 밤 별. 터치 이벤트는 통과시킴 */
export default function WeatherFxLayer({ theme }: WeatherFxLayerProps) {
    const { height, width } = useWindowDimensions()

    if (theme === 'sunny' || theme === 'cloudy') {
        return null
    }

    return (
        <View pointerEvents="none" style={styles.layer}>
            {theme === 'rain'
                ? RAIN_PARTICLES.map((particle, index) => (
                    <FallItem
                        key={`rain-${index}`}
                        particle={particle}
                        kind="rain"
                        screenH={height}
                    />
                ))
                : null}
            {theme === 'snow'
                ? SNOW_PARTICLES.map((particle, index) => (
                    <FallItem
                        key={`snow-${index}`}
                        particle={particle}
                        kind="snow"
                        screenH={height}
                    />
                ))
                : null}
            {theme === 'night'
                ? STAR_DOTS.map((star, index) => (
                    <StarItem key={`star-${index}`} star={star} screenW={width} />
                ))
                : null}
        </View>
    )
}

const styles = StyleSheet.create({
    layer: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        overflow: 'hidden',
    },
    particle: {
        position: 'absolute',
        top: 0,
    },
    star: {
        position: 'absolute',
        borderRadius: 99,
        backgroundColor: '#ffffff',
    },
})
