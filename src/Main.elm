module Main exposing (..)

import Browser
import Browser.Navigation as Navigation
import Element exposing (..)
import Element.Input as Input
import Html
import Html.Attributes
import Task
import Time
import Url


main : Program () Model Msg
main =
    Browser.application
        { init = init
        , onUrlChange = onUrlChange
        , onUrlRequest = onUrlRequest
        , subscriptions = subscriptions
        , update = update
        , view = view
        }


type alias Model =
    { start : Maybe Time.Posix, now : Time.Posix }


init : () -> Url.Url -> Navigation.Key -> ( Model, Cmd Msg )
init _ _ _ =
    ( { start = Nothing, now = Time.millisToPosix 0 }, Cmd.none )


type Msg
    = NoOp
    | Tick Time.Posix
    | StartTime
    | GotStartTime Time.Posix


onUrlChange : a -> Msg
onUrlChange _ =
    NoOp


onUrlRequest : Browser.UrlRequest -> Msg
onUrlRequest _ =
    NoOp


subscriptions : Model -> Sub Msg
subscriptions _ =
    Time.every 1000 Tick


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Tick now ->
            ( { model | now = now }, Cmd.none )

        NoOp ->
            ( model, Cmd.none )

        StartTime ->
            ( model, Task.perform GotStartTime Time.now )

        GotStartTime start ->
            ( { model | start = Just start }, Cmd.none )


view : Model -> Browser.Document Msg
view model =
    { title = "Timer"
    , body =
        List.singleton <|
            layout [] <|
                column [ centerX, centerY, spacing 10 ]
                    [ Input.button [ centerX ] { onPress = Just StartTime, label = text "Start" }
                    , viewTimer model
                    ]
    }


viewTimer : Model -> Element msg
viewTimer model =
    let
        duration =
            case model.start of
                Just start ->
                    let
                        startMillis =
                            Time.posixToMillis start

                        nowMillis =
                            Time.posixToMillis model.now
                    in
                    nowMillis - startMillis

                Nothing ->
                    0
    in
    html <|
        Html.node
            "format-duration"
            [ Html.Attributes.attribute "duration" (String.fromInt duration) ]
            []
